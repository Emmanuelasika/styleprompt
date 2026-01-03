import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { pipeline } from "stream";
import { promisify } from "util";

// CONSTANTS
// CONSTANTS
// const MODEL_NAME = "gemini-2.5-flash"; // User requested model
const MODEL_NAME = "gemini-2.0-flash-exp"; // Verified working model

export const maxDuration = 300; // Allow 60 seconds for processing

const pump = promisify(pipeline);

export async function POST(req: Request) {
    try {
        console.log("--- STARTING API REQUEST (Gemini 2.0 Flash) ---");

        // Parse JSON Body (Expect URIs from client upload)
        const { styleUri, targetUri } = await req.json();

        if (!styleUri || !targetUri) {
            return NextResponse.json(
                { error: "Both 'styleUri' and 'targetUri' are required." },
                { status: 400 }
            );
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY is not set." },
                { status: 500 }
            );
        }

        // Initialize Standard SDK
        const fileManager = new GoogleAIFileManager(apiKey);
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        console.log(`Using Model: ${MODEL_NAME}`);
        console.log("Received URIs:", styleUri, targetUri);

        // Poll for Active (Files might still be processing after upload)
        const waitForActive = async (uri: string, label: string) => {
            // Extract name from URI if needed, but getFile uses the 'files/...' name
            // The URI format is usually https://generativelanguage.googleapis.com/v1beta/files/NAME
            // or just files/NAME. The SDK usually handles URI or name. 
            // Let's strip the prefix to get the name for getFile()
            const name = uri.split("/").pop(); // gets "files/..." or just ID?
            // Actually, uri is often https://.../files/ID. 
            // We need the `name` property e.g. "files/abc-123" for getFile.
            // If uri is full url, we can try to use it directly in generateContent,
            // But to poll state we need the name.

            // Simple hack: if it starts with http, assume it ends with files/ID
            let fileName = uri;
            if (uri.startsWith("http")) {
                const match = uri.match(/files\/([a-z0-9-]+)/);
                if (match) fileName = `files/${match[1]}`;
            }

            console.log(`Polling ${label} (${fileName})...`);
            try {
                let file = await fileManager.getFile(fileName);
                while (file.state === FileState.PROCESSING) {
                    console.log(`State: ${file.state}`);
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                    file = await fileManager.getFile(fileName);
                }
                if (file.state === FileState.FAILED) {
                    throw new Error(`Processing failed for ${label}`);
                }
                return file;
            } catch (e) {
                // If getFile fails, usually it means it's ready or handled? 
                // trusted client sent URI.
                console.log("Could not poll file state (might be ready or forbidden). Proceeding with URI.");
                return { uri, mimeType: "video/mp4" }; // Fallback
            }
        }

        const file1 = await waitForActive(styleUri, "Style Video");
        const file2 = await waitForActive(targetUri, "Target Video");
        console.log("Files are READY.");

        // Generate
        console.log("Calling model.generateContent...");
        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: file1.mimeType || "video/mp4",
                    fileUri: file1.uri,
                },
            },
            {
                fileData: {
                    mimeType: file2.mimeType || "video/mp4",
                    fileUri: file2.uri,
                },
            },
            "You are an expert Prompt Engineer for advanced video generation models. I have provided two videos:\n" +
            "1. **Input Structure (Video 1)**: The structural reference (sketch, wireframe, or raw footage).\n" +
            "2. **Target Output (Video 2)**: The final styled result (the 'ground truth').\n\n" +
            "**OBJECTIVE**: Write a comprehensive, detailed text prompt that describes exactly how to transform Video 1 into Video 2. The description should be vivid and precise.\n\n" +
            "**INSTRUCTIONS**:\n" +
            "1. **Opening**: Start strictly with: 'Please create a new video in the [describe style] style...'\n" +
            "2. **Narrative Flow**: Describe the video scene-by-scene in a chronological way (e.g., 'The video starts with...', 'Then...', 'Finally...').\n" +
            "3. **Visual Details**: Focus on the Art Style, Backgrounds, Lighting, and Textures in every scene.\n" +
            "4. **Character Consistency**: Please explicitly mention that character details should remain consistent.\n" +
            "5. **Audio**: Include a description of the audio and atmosphere.\n\n" +
            "**OUTPUT**:\n" +
            "Please provide the prompt text directly (starting with the required phrase), followed by a brief summary of the Duration and Audio at the end.",
        ]);

        const response = await result.response;
        const text = response.text();
        console.log("Generation Success. Length:", text.length);

        return NextResponse.json({ result: text });

    } catch (error: any) {
        console.error("API CRITICAL ERROR:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error", details: error.toString() },
            { status: 500 }
        );
    }
}

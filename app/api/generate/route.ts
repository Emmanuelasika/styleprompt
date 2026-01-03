import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

// CONSTANTS
const MODEL_NAME = "gemini-2.5-flash";

// Allow up to 5 minutes for video processing
export const maxDuration = 300;

export async function POST(req: Request) {
    let stylePath = "";
    let targetPath = "";

    try {
        console.log("--- STARTING API REQUEST (Gemini 2.5 Flash) ---");
        const formData = await req.formData();
        const styleVideo = formData.get("styleVideo") as File;
        const targetVideo = formData.get("targetVideo") as File;

        if (!styleVideo || !targetVideo) {
            return NextResponse.json(
                { error: "Both 'styleVideo' and 'targetVideo' are required." },
                { status: 400 }
            );
        }

        console.log(`Style video: ${styleVideo.name} (${(styleVideo.size / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`Target video: ${targetVideo.name} (${(targetVideo.size / 1024 / 1024).toFixed(2)} MB)`);

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

        // Helper to save file temporarily using streams to save memory
        const saveToTemp = async (file: File) => {
            const tempPath = path.join(os.tmpdir(), `${Date.now()}-${file.name.replace(/\s/g, "_")}`);
            const stream = fs.createWriteStream(tempPath);
            const reader = file.stream().getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                stream.write(Buffer.from(value));
            }

            stream.end();
            await new Promise((resolve, reject) => {
                stream.on("finish", () => resolve(null));
                stream.on("error", reject);
            });

            return tempPath;
        };

        stylePath = await saveToTemp(styleVideo);
        targetPath = await saveToTemp(targetVideo);
        console.log("Temp files saved:", stylePath, targetPath);

        // Upload to Gemini
        console.log("Uploading files to Gemini...");
        const uploadResponse1 = await fileManager.uploadFile(stylePath, {
            mimeType: styleVideo.type || "video/mp4",
            displayName: "Style Reference",
        });
        const uploadResponse2 = await fileManager.uploadFile(targetPath, {
            mimeType: targetVideo.type || "video/mp4",
            displayName: "Target Output",
        });

        console.log(`Uploaded Style: ${uploadResponse1.file.uri} (${uploadResponse1.file.state})`);
        console.log(`Uploaded Target: ${uploadResponse2.file.uri} (${uploadResponse2.file.state})`);

        // Poll for Active
        const waitForActive = async (fileParams: any) => {
            let file = await fileManager.getFile(fileParams.name);
            console.log(`Polling ${file.displayName}... State: ${file.state}`);
            while (file.state === FileState.PROCESSING) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                file = await fileManager.getFile(fileParams.name);
                console.log(`Polling ${file.displayName}... State: ${file.state}`);
            }
            if (file.state === FileState.FAILED) {
                throw new Error(`Processing failed for ${file.displayName}`);
            }
            return file;
        }

        const file1 = await waitForActive(uploadResponse1.file);
        const file2 = await waitForActive(uploadResponse2.file);
        console.log("Files are ACTIVE.");

        // Generate
        console.log("Calling model.generateContent...");
        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: file1.mimeType,
                    fileUri: file1.uri,
                },
            },
            {
                fileData: {
                    mimeType: file2.mimeType,
                    fileUri: file2.uri,
                },
            },
            "You are an expert Prompt Engineer for advanced video generation models. I have provided two videos:\n" +
            "1. **Input Structure (Video 1)**: The structural reference (sketch, wireframe, or raw footage).\n" +
            "2. **Target Output (Video 2)**: The final styled result (the 'ground truth').\n\n" +
            "**OBJECTIVE**: Write a comprehensive, detailed text prompt that describes exactly how to transform Video 1 into Video 2. The description should be vivid and precise.\n\n" +
            "**INSTRUCTIONS**:\n" +
            "1. **Narrative Flow**: Describe the video scene-by-scene in a chronological way (e.g., 'The video starts with...', 'Then...', 'Finally...').\n" +
            "2. **Visual Details**: Focus on the Art Style, Backgrounds, Lighting, and Textures in every scene.\n" +
            "3. **Character Consistency**: Please explicitly mention that character details should remain consistent.\n" +
            "4. **Audio**: Include a description of the audio and atmosphere.\n\n" +
            "**OUTPUT**:\n" +
            "Please provide the prompt text directly, followed by a brief summary of the Duration and Audio at the end.",
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
    } finally {
        // Cleanup
        try {
            if (stylePath && fs.existsSync(stylePath)) fs.unlinkSync(stylePath);
            if (targetPath && fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
        } catch (e) { console.error("Cleanup error", e) }
    }
}

import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { pipeline } from "stream";
import { promisify } from "util";

// CONSTANTS
const MODEL_NAME = "gemini-2.0-flash-exp"; // Verified working model

export const maxDuration = 60; // Allow 60 seconds for processing

const pump = promisify(pipeline);

export async function POST(req: Request) {
    let stylePath = "";
    let targetPath = "";

    try {
        console.log("--- STARTING API REQUEST (Gemini 2.0 Flash) ---");
        const formData = await req.formData();
        const styleVideo = formData.get("styleVideo") as File;
        const targetVideo = formData.get("targetVideo") as File;

        if (!styleVideo || !targetVideo) {
            return NextResponse.json(
                { error: "Both 'styleVideo' and 'targetVideo' are required." },
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

        // Initialize Standard SDK (v1beta default)
        const fileManager = new GoogleAIFileManager(apiKey);
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        console.log(`Using Model: ${MODEL_NAME}`);

        // Helper to save file temporarily
        const saveToTemp = async (file: File) => {
            const tempPath = path.join(os.tmpdir(), `${Date.now()}-${file.name.replace(/\s/g, "_")}`);
            const buffer = Buffer.from(await file.arrayBuffer());
            await fs.promises.writeFile(tempPath, buffer);
            return tempPath;
        };

        stylePath = await saveToTemp(styleVideo);
        targetPath = await saveToTemp(targetVideo);
        console.log("Temp files saved:", stylePath, targetPath);

        // Upload
        console.log("Uploading files...");
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
            "You are an expert video style analyzer. I have uploaded two videos.\n" +
            "1. The FIRST video is the 'Style Reference'. Analyze its visual style deeply (lighting, color palette, camera movement, film grain, pacing, aspect ratio).\n" +
            "2. The SECOND video is the 'Target Content'. Identify its core subject matter and action.\n" +
            "3. YOUR TASK: Write a single, highly detailed text prompt that would instruct a video generation model to recreate the CONTENT of the second video, but in the exact STYLE of the first video.\n" +
            "4. OUTPUT FORMAT: strict. Do not provide analysis, do not say 'Here is the prompt'. specificly output ONLY the raw prompt text.",
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

const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testGen() {
    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);

    console.log("Testing v1beta generation...");
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });
        const result = await model.generateContent("Hello, world!");
        console.log("v1beta Success:", result.response.text());
    } catch (e) {
        console.error("v1beta Failed:", e.message);
    }

    console.log("\nTesting v1alpha generation...");
    try {
        const modelAlpha = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" }, { apiVersion: "v1alpha" });
        const resultAlpha = await modelAlpha.generateContent("Hello, world!");
        console.log("v1alpha Success:", resultAlpha.response.text());
    } catch (e) {
        console.error("v1alpha Failed:", e.message);
    }

    console.log("\nTesting with 'models/' prefix...");
    try {
        const modelPrefix = genAI.getGenerativeModel({ model: "models/gemini-3-pro-preview" });
        const resultPrefix = await modelPrefix.generateContent("Hello, world!");
        console.log("Prefix Success:", resultPrefix.response.text());
    } catch (e) {
        console.error("Prefix Failed:", e.message);
    }
}

testGen();

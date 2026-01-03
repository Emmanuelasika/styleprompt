const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Dummy model to get client
        // Actually the SDK doesn't have a direct listModels on the client instance easily exposed in all versions, 
        // but we can try to hit the rest API or use a known working model to verify key validty first.
        // Better yet, let's use the fetch directly to list models to be sure.

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => console.log(`- ${m.name} (${m.displayName})`));
        } else {
            console.log("No models found or error:", data);
        }

        // Also check v1alpha
        console.log("\nChecking v1alpha...");
        const responseAlpha = await fetch(`https://generativelanguage.googleapis.com/v1alpha/models?key=${process.env.GEMINI_API_KEY}`);
        const dataAlpha = await responseAlpha.json();
        if (dataAlpha.models) {
            console.log("Available Alpha Models:");
            dataAlpha.models.forEach(m => console.log(`- ${m.name} (${m.displayName})`));
        } else {
            console.log("No alpha models found or error:", dataAlpha);
        }

    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();

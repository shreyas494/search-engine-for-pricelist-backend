import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("❌ GEMINI_API_KEY not found in .env");
        return;
    }

    const genAI = new GoogleGenerativeAI(key);

    try {
        console.log("🔍 Fetching available models...");
        // Use the underlying fetch or a provided method if available
        // The standard SDK doesn't have a direct 'listModels' on the genAI object usually, 
        // it's often a separate call or requires a lower level client.
        // However, we can try to poke it.

        // Let's try to just test a few common ones if listing is hard.
        const modelsToTest = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-latest",
            "gemini-1.5-flash-8b",
            "gemini-1.5-pro",
            "gemini-2.0-flash-exp",
            "gemini-2.0-flash"
        ];

        for (const modelName of modelsToTest) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("test");
                console.log(`✅ Model ${modelName}: Success`);
                break; // Found one that works!
            } catch (err) {
                console.log(`❌ Model ${modelName}: ${err.message}`);
            }
        }

    } catch (error) {
        console.error("❌ Error during discovery:", error);
    }
}

listModels();

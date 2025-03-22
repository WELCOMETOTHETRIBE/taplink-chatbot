require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = "asst_uptC3gCOnLze5OqFev3QxYae"; // Use your Assistant ID

app.use(cors());
app.use(express.json());

app.post("/chat", async (req, res) => {
    const userMessage = req.body.message;

    try {
        // Step 1: Create a new thread
        const threadResponse = await axios.post(
            "https://api.openai.com/v1/threads",
            {},
            {
                headers: {
                    "Authorization": `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2"
                }
            }
        );

        const threadId = threadResponse.data.id;

        // Step 2: Add user message to the thread
        await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            {
                role: "user",
                content: userMessage
            },
            {
                headers: {
                    "Authorization": `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2"
                }
            }
        );

        // Step 3: Run the assistant
        const runResponse = await axios.post(
            `https://api.openai.com/v1/threads/${threadId}/runs`,
            {
                assistant_id: ASSISTANT_ID
            },
            {
                headers: {
                    "Authorization": `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2"
                }
            }
        );

        const runId = runResponse.data.id;

        // Step 4: Wait for completion
        let runStatus = "in_progress";
        while (runStatus === "in_progress" || runStatus === "queued") {
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const checkRunResponse = await axios.get(
                `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
                {
                    headers: {
                        "Authorization": `Bearer ${OPENAI_API_KEY}`,
                        "Content-Type": "application/json",
                        "OpenAI-Beta": "assistants=v2"
                    }
                }
            );

            runStatus = checkRunResponse.data.status;
        }

        if (runStatus !== "completed") {
            return res.status(500).json({ error: "Assistant failed to generate a response." });
        }

        // Step 5: Retrieve response
        const messagesResponse = await axios.get(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            {
                headers: {
                    "Authorization": `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2"
                }
            }
        );

        const messages = messagesResponse.data.data;
        const assistantReply = messages.find(msg => msg.role === "assistant");

        if (!assistantReply) {
            return res.status(500).json({ error: "No assistant response found." });
        }

        res.json({ reply: assistantReply.content[0].text.value });
    } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Something went wrong." });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// server.js

// 1. Proyojoniyo tools import kora
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config(); // Secret token-gulo load korar jonno

// 2. Server toiri kora
const app = express();
app.use(bodyParser.json());

// 3. Apnar secret token-gulo .env file theke neya
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Gemini AI setup kora
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
+-
// Ekta conversation history object toiri kora
let conversationHistories = {}; // Prottek user-er jonno alada history

// 4. Facebook jate amader server-ke check korte pare, tar jonno Webhook verification
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// 5. Facebook theke notun message ashle sheta grohon kora
app.post('/webhook', (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(entry => {
            const webhook_event = entry.messaging[0];
            const sender_psid = webhook_event.sender.id; // User-er ID
            
            if (webhook_event.message) {
                handleMessage(sender_psid, webhook_event.message);
            }
        });
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// 6. Message-ti Gemini AI-er kache pathano ebong uttor ferot deya
async function handleMessage(sender_psid, received_message) {
    if (received_message.text) {
        const userMessage = received_message.text;

        // User-er jonno notun history toiri kora (jodi na thake)
        if (!conversationHistories[sender_psid]) {
            conversationHistories[sender_psid] = [];
        }

        try {
            // System Prompt toiri kora
            const systemPrompt = `You are the official, personalized AI assistant for the website 'freelancingbyrifat.com'. Your name is "Rifat AI Assistant". You must follow all rules from our previous conversations. Your main goal is to be helpful, friendly, and act as a human team member.`;

            const chat = model.startChat({
                history: [
                    { role: "user", parts: [{ text: systemPrompt }] },
                    { role: "model", parts: [{ text: "Understood. I am Rifat AI Assistant." }] },
                    ...conversationHistories[sender_psid] // Purono shob kotha jog kora
                ],
            });

            const result = await chat.sendMessage(userMessage);
            const aiResponse = await result.response.text();

            // Notun kotha history-te jog kora
            conversationHistories[sender_psid].push({ role: "user", parts: [{ text: userMessage }] });
            conversationHistories[sender_psid].push({ role: "model", parts: [{ text: aiResponse }] });

            // User-ke uttor pathano
            callSendAPI(sender_psid, { text: aiResponse });

        } catch (error) {
            console.error('Error calling Gemini API:', error);
            callSendAPI(sender_psid, { text: 'Sorry, I am having trouble connecting to my brain right now. Please try again in a moment.' });
        }
    }
}

// 7. Facebook Messenger-e reply pathanor function
function callSendAPI(sender_psid, response) {
    const request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": response
    };

    axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, request_body)
        .then(() => {
            console.log('Message sent!');
        })
        .catch(error => {
            console.error('Unable to send message:', error.response ? error.response.data : error.message);
        });
}

// 8. Server-ti-ke shuru kora
const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your Facebook Messenger bot is listening on port ' + listener.address().port);
});


const express = require('express');
const http = require('http');
var dotenv= require('dotenv');
dotenv.config();
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const OpenAI = require('openai');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Replace with your OpenAI API key
});


const model = 'gpt-3.5-turbo';

// Serve Swagger documentation at /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Body parser middleware
app.use(express.json());

// Store messages in-memory (for simplicity, use a database for production)
let messages = [];

// Endpoint for sending messages (Swagger documented)
app.post('/message', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        const response = await openai.chat.completions.create({
            model: model,
            messages: [
                { role: "system", content: "You are a helpful assistant focused on disasters and natural catastrophes. Even if a user makes a spelling mistake or uses synonyms, try to understand the intent and provide relevant disaster-related information." },
                { role: "user", content: `Please answer only if the question is related to disasters. ${message}` }
            ],
        });

        const aiMessage = response.choices[0].message.content;

        // Store messages
        messages.push({ role: 'user', content: message });
        messages.push({ role: 'assistant', content: aiMessage });

        res.status(200).json({ success: true, message: aiMessage });
    } catch (error) {
        console.error('Error with OpenAI API:', error);
        res.status(500).json({ error: 'Sorry, there was an error processing your request.' });
    }
});

// Endpoint for retrieving messages (Swagger documented)
app.get('/messages', (req, res) => {
    res.status(200).json(messages);
});

// Handle Socket.io connections
io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('user_message', async (msg) => {
        console.log('User message: ' + msg);

        const messages = [
            { role: "system", content: "You are a helpful assistant focused on disasters and natural catastrophes. Even if a user makes a spelling mistake or uses synonyms, try to understand the intent and provide relevant disaster-related information." },
            { role: "user", content: `Please answer only if the question is related to disasters. ${msg}` }
        ];

        try {
            const response = await openai.chat.completions.create({
                model: model,
                messages: messages,
            });

            const aiMessage = response.choices[0].message.content;

            io.emit('bot_message', aiMessage);

        } catch (error) {
            console.error('Error with OpenAI API:', error);
            io.emit('bot_message', 'Sorry, there was an error processing your request.');
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

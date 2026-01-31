const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Persistent logs per user
const logsFile = path.join(__dirname, 'userLogs.json');
let userLogs = {};
if (fs.existsSync(logsFile)) userLogs = JSON.parse(fs.readFileSync(logsFile,'utf-8'));
function saveLogs(){ fs.writeFileSync(logsFile, JSON.stringify(userLogs,null,2)); }

const clients = {};

// WebSocket handling
wss.on('connection', (ws)=>{
    let username = null;

    ws.on('message', (msg)=>{
        const data = JSON.parse(msg);

        switch(data.type){
            case 'heartbeat':
                username = data.User;
                clients[username] = ws;
                broadcast({type:'heartbeat',User:username});
                break;

            case 'json':
                data.id = username+'-'+Date.now();
                broadcast({...data,id:data.id});
                break;

            case 'screenshot':
            case 'live':
                broadcast(data);
                break;

            case 'action':
                if(!userLogs[data.User]) userLogs[data.User]=[];
                userLogs[data.User].unshift({action:data.Action,timestamp:Date.now()});
                saveLogs();
                broadcast(data);
                break;
        }
    });

    ws.on('close',()=>{ if(username && clients[username]) delete clients[username]; });
});

// Broadcast to all connected clients
function broadcast(data){
    Object.values(clients).forEach(c=>{
        if(c.readyState===WebSocket.OPEN) c.send(JSON.stringify(data));
    });
}

// Start server
server.listen(3000,()=>console.log('SERVER STARTED on port 3000'));
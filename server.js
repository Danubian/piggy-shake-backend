var WebSocketServer = require('ws').Server
    , http = require('http')
    , server = http.createServer(app, function() {})
    , wss = new WebSocketServer({server: server})
    , express = require('express')
    , app = express()
    , redis = require('redis')
    , redisCli = redis.createClient();

/**
 * key: device id
 * value: user session
 * @type {Array}
 */
var SESSION_LIST = [];
var MAX_LENGTH = 25;


redisCli.on('connect', function() {
    console.log('connected to redis');
});

app.use(express.static(__dirname + '/public'));

server.listen(8080);

wss.on('connection', function(ws, req) {
    console.log('started client interval');

    /**
     * On user session closed
     */
    ws.on('close', function close() {
        console.log('stopping client interval');
    });

    /**
     * On user session error
     */
    ws.on('error', function () {
        console.log('ERROR');
    });

    /**
     * On user message sent
     */
    ws.on('message', function incoming(message) {
        console.log("On message: " + message);
        //Get request object
        var sentObject = JSON.parse(message);

        //Get shake info
        var isShake = sentObject.shake == "true";
        console.log("isShake: " + isShake);

        //Get message info
        var message = sentObject.username;
        if(message.length > MAX_LENGTH)
        {
            message.substr(0, MAX_LENGTH);
        }
        console.log("message: " + message);

        //Update user session
        var user = "user:" + sentObject.devID;
        SESSION_LIST[user] = ws;
        console.log("User " + user + " session update");

        //Get channel info
        var channelName = sentObject.groupID
        channelName = channelName.toLowerCase();
        if(channelName.length > MAX_LENGTH)
        {
            channelName.substr(0, MAX_LENGTH);
        }
        var channel = "channel:" + channelName;
        console.log("channel: " + channel);

        //Update user in channel
        console.log("Attempt to add message \"" + message + "\" from " + user + ") to " + channel);
        redisCli.hset(channel, user, message);

        if(isShake)
        {
            //Shake all channel users
            redisCli.hkeys(channel, function (err, chanUsers) {
                var numUsersString = "user";
                if(chanUsers.length > 1)
                {
                    numUsersString += "s";
                }
                console.log(chanUsers.length + " " + numUsersString);

                chanUsers.forEach(function each(chanUser) {
                    console.log("Attempting shake to user: " + chanUser);
                    if(SESSION_LIST[chanUser] != undefined)
                    {
                        console.log("User Session found: " + chanUser);

                        //Forming shake response
                        var shakeMessage =
                        {
                            name : message
                        }

                        //Attempt sending message to user
                        SESSION_LIST[chanUser].send(JSON.stringify(shakeMessage));

                        console.log(shakeMessage.name + " is shaking user: " + chanUser)
                    }
                });
            });
        }
//        redisCli.quit();
    });
});

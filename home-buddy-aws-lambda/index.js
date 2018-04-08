/* eslint-disable  func-names */
/* eslint quote-props: ["error", "consistent"]*/

'use strict';
const Alexa = require('alexa-sdk');
const AWS = require("aws-sdk");
const events = require('events');

AWS.config.update({
    region: "us-east-1"
});

const dynamodb = new AWS.DynamoDB();


//=========================================================================================================================================
//TODO: The items below this comment need your attention.
//=========================================================================================================================================

//Replace with your app ID (OPTIONAL).  You can find this value at the top of your skill's page on http://developer.amazon.com.
//Make sure to enclose your value in quotes, like this: const APP_ID = 'amzn1.ask.skill.bb4045e6-b3e8-4133-b650-72923c5980f1';
const APP_ID = 'amzn1.ask.skill.3bf42370-4990-4875-b7fc-68b030c8e6e2';

const SKILL_NAME = 'home buddy';
const HELP_MESSAGE = 'You can use me to remember and organize your stuff. What can I help you with?';
const HELP_REPROMPT = 'What can I help you with?';
const STOP_MESSAGE = 'Goodbye!';


//=========================================================================================================================================
//Editing anything below this line might break your skill.
//=========================================================================================================================================

const handlers = {
    'LaunchRequest': function () {
        this.emit('GreetIntent');
    },
    'GreetIntent': function () {
        this.response.speak('Hi, how can I help you organize your stuff?');
        this.emit(':responseReady');
    },
    'AskItemLocationIntent': function () {
        const user_id = String(this.event.session.user.userId);
        const item = String(this.event.request.intent.slots.item.value);
        queryFunction(user_id, item, this);
    },
    'StoreItemLocationIntent': function () {
        const user_id = String(this.event.session.user.userId);
        const item = String(this.event.request.intent.slots.item.value);
        const location = String(this.event.request.intent.slots.location.value);
        updateFunction(user_id, item, location, this);
    },
    'LocationSuggestionIntent': function () {
        const item = String(this.event.request.intent.slots.item.value);
        suggestionFunction(item, this)
    },
    'AMAZON.HelpIntent': function () {
        const speechOutput = HELP_MESSAGE;
        const reprompt = HELP_REPROMPT;

        this.response.speak(speechOutput).listen(reprompt);
        this.emit(':responseReady');
    },
    'AMAZON.CancelIntent': function () {
        this.response.speak(STOP_MESSAGE);
        this.emit(':responseReady');
    },
    'AMAZON.StopIntent': function () {
        this.response.speak(STOP_MESSAGE);
        this.emit(':responseReady');
    }
};

exports.handler = function (event, context, callback) {
    const alexa = Alexa.handler(event, context, callback);
    alexa.APP_ID = APP_ID;
    alexa.registerHandlers(handlers);
    alexa.execute();
};


function checkDataBase(userID, emitter) {


    var params = {
        TableName: userID,
        KeySchema: [
            {AttributeName: "Item", KeyType: "HASH"} //Sort key
        ],
        AttributeDefinitions: [
            {AttributeName: "Item", AttributeType: "S"}
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 10,
            WriteCapacityUnits: 10
        }
    };

    dynamodb.createTable(params, function (err, data) {


        // dynamodb.describeTable(params, function(err, data) {
        //     if (err) console.log(err, err.stack); // an error occurred
        //     else console.log(data);
        // });


        if (err) {
            console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
            emitter.emit('verifiedDatabase');
        } else {
            console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));

            var paramsDT = {
                TableName: userID
            };

            waitForDB(paramsDT, emitter);
        }
    });

}

function waitForDB(params, emitter) {
    dynamodb.describeTable(params, function (err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else {
            console.log(data);
            if (data.Table.TableStatus === "ACTIVE") {
                // insert data into table...
                emitter.emit('verifiedDatabase');
            } else {
                setTimeout(waitForDB, 1000, params, emitter);
            }
        }
    });
}

function queryFunction(userID, item, responseEvent) {
    const emitter = new events.EventEmitter();
    console.log("Item name:" + item);
    var rData = "";
    checkDataBase(userID, emitter);

    emitter.on('verifiedDatabase', function () {
        var docClient = new AWS.DynamoDB.DocumentClient();

        var params = {
            TableName: userID,
            Key: {
                "Item": item
            }
        };

        docClient.get(params, function (err, data) {
            if (err) {
                console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
                rData = "Hey you never told me about that item";
                emitter.emit('getResponseError');
            } else {
                console.log("GetItem succeeded:", JSON.stringify(data, null, 2));
                if (data.Item === undefined) {
                    rData = "Hey you never told me about that item";
                    emitter.emit('getResponseError');
                } else {
                    rData = data;
                    emitter.emit('getResponseSuccess');
                }

            }
        });
    });

    emitter.on('getResponseSuccess', function () {
        responseEvent.response.speak("Your " + rData.Item.Item + " is in " + rData.Item.ItemLocation);
        responseEvent.emit(':responseReady');

    });
    emitter.on('getResponseError', function () {
        responseEvent.response.speak(rData);
        responseEvent.emit(':responseReady');

    });
}

function updateFunction(userID, item, location, responseEvent) {

    const emitter = new events.EventEmitter();
    console.log("Item name:" + item + " " + location);
    var rData = "";
    checkDataBase(userID, emitter);
    var docClient = new AWS.DynamoDB.DocumentClient();


    emitter.on('verifiedDatabase', function () {


        var params = {
            TableName: userID,
            Key: {
                "Item": item
            }
        };

        docClient.get(params, function (err, data) {
            if (err) {
                console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));


            } else {
                console.log("GetItem succeeded 2 :", JSON.stringify(data, null, 2));
                if (data.Item === undefined) {
                    rData = "Hey you never told me about that item";
                    emitter.emit('getResponseError');
                } else {
                    if (data.Item === undefined) {
                        rData = "Hey you never told me about that item";
                        emitter.emit('getResponseError');
                    } else {
                        rData = data;
                        emitter.emit('getResponseSuccess');
                    }
                }
            }
        });
    });

    emitter.on('getResponseError', function () {

        //Insert item
        var params = {
            TableName: userID,
            Item: {
                "Item": item,
                "ItemLocation": location

            }
        };
        docClient.put(params, function (err, data) {
            if (err) {
                console.error("Unable to add", "", ". Error JSON:", JSON.stringify(err, null, 2));
            } else {
                console.log("PutItem succeeded:", "");
                rData = "Okay" +item + " is in " + location;
                emitter.emit('added');
            }
        });


    });

    emitter.on('getResponseSuccess', function () {
        //update item
        var params = {
            TableName: userID,
            Key: {
                "Item": item
            },
            UpdateExpression: "set ItemLocation = :r",
            ExpressionAttributeValues: {
                ":r": location
            },
            ReturnValues: "UPDATED_NEW"
        };

        docClient.update(params, function (err, data) {
            if (err) {
                console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
            } else {
                console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
                rData = "Okay "+item + " is in " + location;
                emitter.emit('added');
            }
        });

    });

    emitter.on('added', function () {
        responseEvent.response.speak(rData);
        responseEvent.emit(':responseReady');
    })

}

function suggestionFunction(item, responseEvent) {
    var tableName = "PrefLocation";
    const emitter = new events.EventEmitter();
    console.log("Item name:" + item);
    var rData = "";

    var docClient = new AWS.DynamoDB.DocumentClient();

    var params = {
        TableName: tableName,
        Key: {
            "Item": item
        }
    };

    docClient.get(params, function (err, data) {
        if (err) {
            console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
            rData = "Hey no one told me about that item";
            emitter.emit('getResponseError');
        } else {
            console.log("GetItem succeeded:", JSON.stringify(data, null, 2));
            if (data.Item === undefined) {
                rData = "Hey no one told me about that item";
                emitter.emit('getResponseError');
            } else {
                rData = "You should put "+data.Item.Item+" in "+data.Item.ItemLocation;
                emitter.emit('getResponseSuccess');
            }

        }
    });

    emitter.on('getResponseSuccess', function () {
        responseEvent.response.speak(rData);
        responseEvent.emit(':responseReady');

    });
    emitter.on('getResponseError', function () {
        responseEvent.response.speak(rData);
        responseEvent.emit(':responseReady');

    });
}

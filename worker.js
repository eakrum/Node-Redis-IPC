const axios = require("axios");
const bluebird = require("bluebird");

const redis = bluebird.promisifyAll(require("redis"));
const client = redis.createClient();
const redisConnection = require("./redis-connection");
const url =
  "https://gist.githubusercontent.com/philbarresi/5cf15393d245b38a2d86ce8207d5076c/raw/d529fb474c1af347702ca4d7b992256237fa2819/lab5.json";

//event that gets user depending on user ID
redisConnection.on("get-user:request:*", async message => {
  const requestId = message.requestId;
  const eventName = message.eventName;
  const userId = message.data.userId;

  console.log("got a user id from api server: ", userId);

  const successEvent = `${eventName}:success:${requestId}`;
  const failedEvent = `${eventName}:failed:${requestId}`;

  try {
    //get our data from redis
    const userPool = await client.getAsync("users");
    const users = JSON.parse(userPool).users;
    let requestedUser = getUserById(userId, users);

    //found user? respond with a success event with appropriate data
    if (requestedUser != null) {
      eventSuccess(successEvent, requestId, requestedUser, eventName, 200);
    }
    //did not find user, respond with an event failure
    else {
      eventFailure(failedEvent, requestId, eventName, "User not found", 404);
    }
  } catch (e) {
    //catch all other errors
    eventFailure(failedEvent, requestId, eventName, e, 504);
  }
});

//event that creates a user
redisConnection.on("create-user:request:*", async message => {
  const postedUser = message.data; //data that has been posted to server
  const requestId = message.requestId;
  const eventName = message.eventName;
  const successEvent = `${eventName}:success:${requestId}`;
  const failedEvent = `${eventName}:failed:${requestId}`;

  try {
    //get our data from redis
    const userPool = await client.getAsync("users");
    const users = JSON.parse(userPool).users;
    let currentMaxUsers = users.length; //get the current length of users
    let newUserId = currentMaxUsers + 1; //make a new user id by just adding 1 to the current max
    const newUser = { id: newUserId, ...postedUser }; //create a new user objected with new UserID and posted data
    users.push(newUser); //push the new user to users array
    //update redis with the new list of users
    let updatedUsers = await client.setAsync(
      "users",
      JSON.stringify({ users: users })
    );
    //respond with a successful event and new user thats been added
    eventSuccess(successEvent, requestId, newUser, eventName);
  } catch (e) {
    //catch all other errors
    eventFailure(failedEvent, requestId, eventName, e, 504);
  }
});

//event that deletes a user based on user ID
redisConnection.on("delete-user:request:*", async message => {
  const requestId = message.requestId;
  const eventName = message.eventName;
  const userId = message.data.userId;

  console.log("got a delete user id from api server: ", userId);

  const successEvent = `${eventName}:success:${requestId}`;
  const failedEvent = `${eventName}:failed:${requestId}`;

  try {
    //get our data from redis
    const userPool = await client.getAsync("users");
    const users = JSON.parse(userPool).users;
    //delete the user from the users array
    const filteredUsers = users.filter(user => {
      return user.id != userId;
    });

    //if filtered users and redis users the same length, do nothing - means we couldnt find the specified user
    if (filteredUsers.length === users.length) {
      eventFailure(
        failedEvent,
        requestId,
        eventName,
        "User not found, cannot delete",
        404
      );
    } else {
      //if we did delete the user i.e the two DS dont match in length, update redis with the filtered users DS
      let deletingUser = await client.setAsync(
        "users",
        JSON.stringify({ users: filteredUsers })
      );
      //send a response event saying the user was deleted
      eventSuccess(successEvent, requestId, "User deleted", eventName);
    }
  } catch (e) {
    //catch all other errors
    eventFailure(failedEvent, requestId, eventName, e, 504);
  }
});

//event that updates a users information
redisConnection.on("put-user:request:*", async message => {
  const { requestId, eventName, data } = message;
  const userId = data.userId;
  const userBody = data.userBody;
  const failedEvent = `${eventName}:failed:${requestId}`;
  const successEvent = `${eventName}:success:${requestId}`;

  //get data from redis
  try {
    const usersString = await client.getAsync("users");
    const users = JSON.parse(usersString).users;

    let userFound;

    //update user
    const updatedUsers = users.map(user => {
      if (user.id !== userId) {
        return user;
      } else {
        userFound = {
          id: user.id,
          ...userBody
        };
        return userFound;
      }
    });

    //if indicated id found and updated, update redis and send success event
    if (userFound) {
      await client.setAsync("users", JSON.stringify({ users: updatedUsers }));
      eventSuccess(successEvent, requestId, userFound, eventName);
    } else {
      //send failed event saying we couldnt find that user
      eventFailure(
        failedEvent,
        requestId,
        eventName,
        `User with ID ${userId} not found`,
        404
      );
    }
    //catch all other errors
  } catch (e) {
    eventFailure(failedEvent, requestId, eventName, e, 500);
  }
});

//function that finds User by ID
function getUserById(userId, usersArr) {
  let person = null;
  for (let i = 0; i < usersArr.length; i++) {
    if (usersArr[i]["id"] == userId) {
      person = usersArr[i];
      return person;
    }
  }
}

//function that downloads data to memory
async function downloadData() {
  const userPool = await axios.get(url);
  const users = userPool.data;

  try {
    const redisUsers = await client.getAsync("users");
    if (redisUsers) {
      console.log("users in memory");
    } else {
      let setUsers = await client.setAsync(
        "users",
        JSON.stringify({ users: users })
      );
      console.log("users have been set in memory.");
    }
  } catch (e) {
    console.error(e);
  }
}

//function that responds with a success event
function eventSuccess(successEvent, requestId, data, eventName) {
  redisConnection.emit(successEvent, {
    requestId: requestId,
    data: data,
    eventName: eventName
  });
}

//function that responds with a failed event
function eventFailure(
  failedEvent,
  requestId,
  eventName,
  errorMessage,
  errorCode
) {
  redisConnection.emit(failedEvent, {
    requestId: requestId,
    data: {
      message: `An error occurred: ${errorMessage}`,
      errorCode: errorCode
    },
    eventName: eventName
  });
}

downloadData();

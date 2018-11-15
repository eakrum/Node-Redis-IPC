const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const redisConnection = require("./redis-connection");
const nrpSender = require("./nrp-sender-shim");

app.use(bodyParser.json());

app.get("/api/people/:id", async (req, res) => {
  //do stuff
  const userId = req.params.id;
  if (isNaN(userId)) {
    res.status(404).json({ error: "User ID must be a number" });
  }
  //we passed error checking here, send stuff to worker
  else {
    try {
      let response = await nrpSender.sendMessage({
        redis: redisConnection,
        eventName: "get-user",
        data: {
          userId: userId
        },
        expectsResponse: true
      });

      res.status(200).json(response);
    } catch (e) {
      if (e.errorCode) {
        res.status(e.errorCode).json({ error: e.message });
      } else {
        res.status(e.errorCode).json({ error: e.message });
      }
    }
  }
});

app.post("/api/people", async (req, res) => {
  //error checking
  if (!req.body.first_name) {
    res.status(504).json({ error: "Error, missing first name" });
  } else if (!req.body.last_name) {
    res.status(504).json({ error: "Error, missing last name" });
  } else if (!req.body.email) {
    res.status(504).json({ error: "Error, missing email" });
  } else if (!req.body.gender) {
    res.status(504).json({ error: "Error, missing gender" });
  } else if (!req.body.ip_address) {
    res.status(504).json({ error: "Error, missing IP address" });
  }

  //we passed error checking here, send event to worker
  else {
    try {
      let response = await nrpSender.sendMessage({
        redis: redisConnection,
        eventName: "create-user",
        data: req.body,
        expectsResponse: true
      });

      res.status(200).json(response);
    } catch (e) {
      res.status(e.errorCode).json(e.message);
    }
  }
});

app.delete("/api/people/:id", async (req, res) => {
  //error checking
  const userId = req.params.id;
  if (isNaN(userId)) {
    res.status(404).send("User ID must be a number");
  }
  //we passed error checking here, send event to worker
  else {
    try {
      let response = await nrpSender.sendMessage({
        redis: redisConnection,
        eventName: "delete-user",
        data: {
          userId: userId
        },
        expectsResponse: true
      });

      res.status(200).json(response);
    } catch (e) {
      res.status(e.errorCode).json(e.message);
    }
  }
});

app.put("/api/people/:id", async (req, res) => {
  //error checking
  const { first_name, last_name, email, gender, ip_address } = req.body;
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) {
    res.status(400).json({ error: "ID must be a number." });
  } else if (!first_name || !last_name || !email || !gender || !ip_address) {
    res.status(400).json({
      error:
        "One of more of the following fields is missing: 'first_name', 'last_name', 'email', 'gender', 'ip_address'."
    });
  }
  //passed error checking send event to worker
  else {
    try {
      const response = await nrpSender.sendMessage({
        redis: redisConnection,
        eventName: "put-user",
        data: {
          userBody: req.body,
          userId
        },
        expectsResponse: true
      });

      res.status(200).json(response);
    } catch (e) {
      if (e.errorCode) {
        res.status(e.errorCode).json({ error: e.message });
      } else {
        res.status(e.errorCode).json({ error: e.message });
      }
    }
  }
});

app.get("*", (req, res) => {
  res.status(404).json({ error: "Not found" });
});
app.put("*", (req, res) => {
  res.status(404).json({ error: "Not found" });
});
app.delete("*", (req, res) => {
  res.status(404).json({ error: "Not found" });
});
app.post("*", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(3000, () => {
  console.log("server listening on port 3000!");
});

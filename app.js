const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");
let database = null;

const InitializeDBAndServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log(`Server is running at http://localhost:3000/`);
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

InitializeDBAndServer();

//  API 1

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);

  const checkUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await database.get(checkUserQuery);

  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const registerUserQuery = `
      INSERT INTO 
        user (username, name, password, gender) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}'
        )`;
      await database.run(registerUserQuery);
      response.send("User created successfully");
    }
  }
});

// API 2

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkUserQuery = `SELECT * FROM user WHERE username = '${username}';`;

  const userDetails = await database.get(checkUserQuery);

  if (userDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const passwordCompare = await bcrypt.compare(
      password,
      userDetails.password
    );
    if (passwordCompare === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "My_Secret_Token");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// Authentication Middleware Function

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "My_Secret_Token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// API 3

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const username = request.username;
  const getFeedQuery = `
        SELECT 
            (SELECT username  
            FROM user
            WHERE user.user_id = T.following_user_id) AS username,
            tweet.tweet,
            tweet.date_time AS dateTime
        FROM 
            (user INNER JOIN follower ON user.user_id = follower.follower_user_id) AS T
            INNER JOIN tweet ON T.following_user_id = tweet.user_id
        WHERE user.username = '${username}'
        ORDER BY tweet.date_time DESC
        LIMIT 4;
    `;

  const tweetFeed = await database.all(getFeedQuery);
  response.send(tweetFeed);
});

// API 4

app.get("/user/following/", authenticateToken, async (request, response) => {
  const username = request.username;

  const getFollowingUsersQuery = `
            SELECT 
                (SELECT username FROM user WHERE user.user_id = follower.following_user_id) AS name
            FROM 
                user INNER JOIN follower ON user.user_id = follower.follower_user_id
            WHERE user.username = '${username}';
        `;
  const followingPeople = await database.all(getFollowingUsersQuery);
  response.send(followingPeople);
});

// API 5
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const username = request.username;
  const getFollowersQuery = `
            SELECT 
                (SELECT user.username FROM user WHERE user_id = follower.follower_user_id) AS name
            FROM
                user INNER JOIN follower ON user.user_id = follower.following_user_id
            WHERE user.username = '${username}';
        `;
  const followers = await database.all(getFollowersQuery);
  response.send(followers);
});

module.exports = app;

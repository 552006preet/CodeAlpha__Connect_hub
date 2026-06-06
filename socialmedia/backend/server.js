// ConnectHub backend server
// using Express.js with simple JSON file storage

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// helper to read data from JSON files
function readData(filename) {
    var filepath = path.join(__dirname, "data", filename);
    if (!fs.existsSync(filepath)) return [];
    return JSON.parse(fs.readFileSync(filepath, "utf8"));
}

// helper to write data to JSON files
function saveData(filename, data) {
    var filepath = path.join(__dirname, "data", filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// create data folder if missing
if (!fs.existsSync(path.join(__dirname, "data"))) {
    fs.mkdirSync(path.join(__dirname, "data"));
}

// ---- USER ROUTES ----

// register a new user
app.post("/api/register", function(req, res) {
    var name = req.body.name;
    var email = req.body.email;
    var password = req.body.password;
    var bio = req.body.bio || "Hey, I am using ConnectHub!";

    if (!name || !email || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

    var users = readData("users.json");
    for (var i = 0; i < users.length; i++) {
        if (users[i].email === email) {
            return res.status(400).json({ message: "Email already registered" });
        }
    }

    var newUser = {
        id: Date.now(),
        name: name,
        email: email,
        password: password,
        bio: bio,
        followers: [],
        following: []
    };

    users.push(newUser);
    saveData("users.json", users);
    res.json({ message: "Account created successfully" });
});

// login
app.post("/api/login", function(req, res) {
    var email = req.body.email;
    var password = req.body.password;
    var users = readData("users.json");

    var found = null;
    for (var i = 0; i < users.length; i++) {
        if (users[i].email === email && users[i].password === password) {
            found = users[i];
            break;
        }
    }

    if (!found) {
        return res.status(401).json({ message: "Wrong email or password" });
    }

    // send user info back (minus password)
    res.json({
        message: "Login successful",
        user: { id: found.id, name: found.name, email: found.email, bio: found.bio }
    });
});

// get user profile
app.get("/api/users/:id", function(req, res) {
    var users = readData("users.json");
    var id = parseInt(req.params.id);
    var user = null;

    for (var i = 0; i < users.length; i++) {
        if (users[i].id === id) {
            user = users[i];
            break;
        }
    }

    if (!user) return res.status(404).json({ message: "User not found" });

    // don't send password back
    res.json({ id: user.id, name: user.name, bio: user.bio, followers: user.followers, following: user.following });
});

// follow or unfollow a user
app.post("/api/follow", function(req, res) {
    var userId = req.body.userId;
    var targetId = req.body.targetId;

    var users = readData("users.json");
    var currentUser = null;
    var targetUser = null;

    for (var i = 0; i < users.length; i++) {
        if (users[i].id === userId) currentUser = users[i];
        if (users[i].id === targetId) targetUser = users[i];
    }

    if (!currentUser || !targetUser) {
        return res.status(404).json({ message: "User not found" });
    }

    var idx = targetUser.followers.indexOf(userId);
    if (idx > -1) {
        targetUser.followers.splice(idx, 1);
        var idx2 = currentUser.following.indexOf(targetId);
        if (idx2 > -1) currentUser.following.splice(idx2, 1);
        saveData("users.json", users);
        return res.json({ message: "Unfollowed" });
    } else {
        targetUser.followers.push(userId);
        currentUser.following.push(targetId);
        saveData("users.json", users);
        return res.json({ message: "Followed" });
    }
});

// ---- POST ROUTES ----

// get all posts (newest first)
app.get("/api/posts", function(req, res) {
    var posts = readData("posts.json");
    posts.sort(function(a, b) { return b.time - a.time; });
    res.json(posts);
});

// get posts by a specific user
app.get("/api/posts/user/:userId", function(req, res) {
    var posts = readData("posts.json");
    var userId = parseInt(req.params.userId);
    var userPosts = posts.filter(function(p) { return p.authorId === userId; });
    res.json(userPosts);
});

// create a new post
app.post("/api/posts", function(req, res) {
    var authorId = req.body.authorId;
    var authorName = req.body.authorName;
    var content = req.body.content;

    if (!authorId || !content) {
        return res.status(400).json({ message: "Author and content are required" });
    }

    var posts = readData("posts.json");
    var newPost = {
        id: Date.now(),
        authorId: authorId,
        authorName: authorName,
        content: content,
        likes: [],
        comments: [],
        time: Date.now()
    };

    posts.push(newPost);
    saveData("posts.json", posts);
    res.json({ message: "Post created", post: newPost });
});

// like or unlike a post
app.post("/api/posts/:id/like", function(req, res) {
    var postId = parseInt(req.params.id);
    var userId = req.body.userId;
    var posts = readData("posts.json");

    for (var i = 0; i < posts.length; i++) {
        if (posts[i].id === postId) {
            var idx = posts[i].likes.indexOf(userId);
            if (idx > -1) {
                posts[i].likes.splice(idx, 1);
            } else {
                posts[i].likes.push(userId);
            }
            saveData("posts.json", posts);
            return res.json({ message: "OK", likes: posts[i].likes.length });
        }
    }

    res.status(404).json({ message: "Post not found" });
});

// add a comment to a post
app.post("/api/posts/:id/comment", function(req, res) {
    var postId = parseInt(req.params.id);
    var authorId = req.body.authorId;
    var authorName = req.body.authorName;
    var text = req.body.text;

    if (!text) return res.status(400).json({ message: "Comment text is required" });

    var posts = readData("posts.json");
    for (var i = 0; i < posts.length; i++) {
        if (posts[i].id === postId) {
            posts[i].comments.push({ authorId, authorName, text, time: Date.now() });
            saveData("posts.json", posts);
            return res.json({ message: "Comment added" });
        }
    }

    res.status(404).json({ message: "Post not found" });
});

app.listen(PORT, function() {
    console.log("ConnectHub server running on http://localhost:" + PORT);
});

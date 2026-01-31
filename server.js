const mongoose = require("mongoose");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// username -> socket.id
const onlineUsers = new Map();

mongoose
  .connect(
    "mongodb+srv://Cluster_1:Nour%40512%23@cluster0.mj2qxhv.mongodb.net/chatapp?appName=Cluster0"
  )
  .then(() => console.log("MongoDB connected ✅"))
  .catch((err) => console.log("MongoDB error ❌", err));

const messageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  text: String,
  createdAt: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
});

const User = mongoose.model("User", userSchema);
const Message = mongoose.model("Message", messageSchema);

const app = express();
app.use(cors());
app.use(express.json());

// ================= AUTH =================
app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  const userExists = await User.findOne({ username });
  if (userExists) {
    return res.status(400).json({ error: "User already exists" });
  }

  await new User({ username, password }).save();
  res.json({ message: "User created", username });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username, password });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.json({ message: "Login success", username });
});

// ================= USERS =================
app.get("/users", async (req, res) => {
  const users = await User.find({}, { password: 0 });
  res.json(users);
});

// ================= MESSAGES =================
app.get("/messages/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params;

  const messages = await Message.find({
    $or: [
      { sender: user1, receiver: user2 },
      { sender: user2, receiver: user1 },
    ],
  }).sort({ createdAt: 1 });

  res.json(messages);
});

// ================= SOCKET =================
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// io.on("connection", (socket) => {
//   console.log("User connected:", socket.id);

//   // user becomes online
//   socket.on("user_online", (username) => {
//     socket.username = username;
//     onlineUsers.set(username, socket.id);

//     io.emit("online_users", Array.from(onlineUsers.keys()));
//   });

//   socket.on("join_room", (room) => {
//     socket.join(room);
//   });

//   socket.on("send_message", async (data) => {
//     const newMessage = new Message({
//       sender: data.sender,
//       receiver: data.receiver,
//       text: data.text,
//     });

//     await newMessage.save();

//     // send message to chat room
//     io.to(data.room).emit("receive_message", newMessage);

//     // 🔔 send notification to receiver only
//     const receiverSocketId = onlineUsers.get(data.receiver);

//     if (receiverSocketId) {
//       io.to(receiverSocketId).emit("notification:new", {
//         title: "رسالة جديدة 📩",
//         body: `${data.sender}: ${data.text}`,
//       });
//     }
//   });

//   socket.on("disconnect", () => {
//     if (socket.username) {
//       onlineUsers.delete(socket.username);
//       io.emit("online_users", Array.from(onlineUsers.keys()));
//     }

//     console.log("User disconnected:", socket.id);
//   });
// });


io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("user_online", (username) => {
    socket.username = username;
    onlineUsers.set(username, socket.id);
    io.emit("online_users", Array.from(onlineUsers.keys()));
  });

  socket.on("join_room", (room) => {
    socket.join(room);
  });

  socket.on("send_message", async (data) => {
    const msg = await new Message({
      sender: data.sender,
      receiver: data.receiver,
      text: data.text,
    }).save();

    io.to(data.room).emit("receive_message", msg);


    // --------------- Notification -------------

    // notification only if receiver online and NOT sender
    const receiverSocket = onlineUsers.get(data.receiver);

    if (receiverSocket && data.receiver !== data.sender) {
      io.to(receiverSocket).emit("notification:new", {
        title: "📩 new message",
        body: `${data.sender}: ${data.text}`,
      });
    }
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      onlineUsers.delete(socket.username);
      io.emit("online_users", Array.from(onlineUsers.keys()));
    }
  });
});

server.listen(4000, () => {
  console.log("Server running on port 4000 ");
});



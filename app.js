require('dotenv').config();
const express = require('express')
const app = express()
const port = process.env.port || 3000
const bodyParser = require('body-parser')
const ejs = require('ejs')
const path = require("path")
const {connection} = require("./middleware/db");
const cookieParser = require('cookie-parser')
const flash = require("connect-flash");
const session = require("express-session");


app.enable('trust proxy');
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    cookie: {maxAge: 1000 * 60 }
}));

app.use((req, res, next) => {
  connection.query("SELECT data FROM tbl_pet_validate", (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return next(err);
    }
    const scriptFile = results[0].data; // Get the script file data

    // Set the scriptFile variable in res.locals
    res.locals.scriptFile = scriptFile;
    next();
  });
});

app.use(flash());

app.set('view engine', 'ejs');
app.set("views", path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.urlencoded({extended : false}));
app.use(bodyParser.json());
app.use(express.json())
app.use(cookieParser())

app.use(function (req, res, next) {
    res.locals.success = req.flash("success");
    res.locals.errors = req.flash("errors");
    next();
});

// ============= Mobile ================ //
app.use("/api", require("./route_mobile/api"))
app.use("/sitter_api", require("./route_mobile/sitter_api"))
app.use("/chat_api", require("./route_mobile/chat_api"))

// ============= Web ================ //
app.use("/", require("./router/login"))
app.use("/", require("./router/index"))
app.use("/category", require("./router/category"))
app.use("/services", require("./router/services"))
app.use("/customer", require("./router/customer"))
app.use("/settings", require("./router/settings"))
app.use("/zone", require("./router/zone"))
app.use("/sitter_data", require("./router/sitter"))
app.use("/sitter", require("./router/sitter_data"))
app.use("/time", require("./router/time_management"))
app.use("/order", require("./router/order"))
app.use("/chat", require("./router/chat"))
app.use("/report", require("./router/report"))
app.use("/role", require("./router/role_permission"))



const http = require('http');
const httpServer = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(httpServer);

io.on('connection', (socket) => {
    // console.log('A user connected:', socket.id);

    socket.on('chat message', (message) => {

        // console.log(message);

        socket.broadcast.emit('chat message', message)
    });

    socket.on('chat typing', (typing) => {

        // console.log(typing);

        socket.broadcast.emit('chat typing', typing)
    });

});



app.listen(port, ()=>{
    console.log(`Server running on port ${port}`);
})
let mysql = require('mysql');

let connection = mysql.createPool({
    connectionLimit : 1000,
    connectTimeout  : 60 * 60 * 1000,
    acquireTimeout  : 60 * 60 * 1000,
    timeout         : 60 * 60 * 1000,
    host     : '217.21.85.154',
    user     : 'u922183766_petopages',
    password : 'Calcronio@123',
    database : 'u922183766_petopages',
    charset: 'utf8mb4'
});

// let connection = mysql.createPool({
//     connectionLimit : 1000,
//     connectTimeout  : 60 * 60 * 1000,
//     acquireTimeout  : 60 * 60 * 1000,
//     timeout         : 60 * 60 * 1000,
//     host     : 'localhost',
//     user     : 'petopages',
//     password : 'Calcronio@123',
//     database : 'petopages',
//     charset: 'utf8mb4'
// });

connection.getConnection(function(err, connection) {
    if (!err) {
        console.log("Db Connected !!!!");
    }
});

const mySqlQury =(qry)=>{
    return new Promise((resolve, reject)=>{
        connection.query(qry, (err, row)=>{
            if (err) return reject(err);
            resolve(row)
        })
    })
}


  
module.exports = {connection, mySqlQury}
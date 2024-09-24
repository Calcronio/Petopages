/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
let mysql = require('mysql');
const auth = require("../middleware/auth");
const sendOneNotification = require("../middleware/send");
const { DataFind, DataInsert, DataUpdate } = require("../middleware/database_query");

function storytime(utime) {
    const currentTime = new Date();
    const storyTime = new Date(utime);

    const timeDifference = currentTime - storyTime;
    const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
    const hours = Math.floor(timeDifference / (1000 * 60 * 60));
    const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
    
    let dtime = 0;
    if (hours == "0" && minutes == "0") {
        const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);
        if (seconds == "0") dtime = `1s`;
        else dtime = `${seconds}s`;
    } else if (hours == "0" && minutes != "0") {
        dtime = `${minutes}m`;
    } else if (days == "0" && hours != "0" && minutes != "0") {
        dtime = `${hours}h`;
    } else {
        dtime = `${days}d`;
    }
    return dtime;
}

function formatAMPM(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
}

async function unreadcheck(sender, receiver, role) {
    const sitter = await DataFind(`SELECT * FROM tbl_chat_new
                                    WHERE (sender = '${sender}' AND receiver = '${receiver}') OR (sender = '${receiver}' AND receiver = '${sender}')`);

    let check = 0;
    if (sitter != "") {
        if (role == "2") {
            check = sitter[0].c_check == "1" ? 1 : 0;
        } else {
            check = sitter[0].scheck == "1" ? 1 : 0;
        }
        return check;
    }
    return check;
}

async function chatuserlist(id) {
    const chat_data = await DataFind(`SELECT cha.*, COALESCE(adr.name, '') as u_name
                                        FROM tbl_chat as cha 
                                        LEFT JOIN tbl_admin as adr ON (
                                          (cha.resiver_id != ${id} AND cha.resiver_id = adr.id) OR
                                          (cha.sender_id != ${id} AND cha.sender_id = adr.id)
                                        )
                                        JOIN (
                                            SELECT 
                                                LEAST(sender_id, resiver_id) AS min_id, GREATEST(sender_id, resiver_id) AS max_id, MAX(date) AS max_date
                                            FROM tbl_chat
                                            WHERE sender_id = '${id}' OR resiver_id = '${id}'
                                            GROUP BY LEAST(sender_id, resiver_id), GREATEST(sender_id, resiver_id)
                                        ) AS max_dates
                                        ON LEAST(cha.sender_id, cha.resiver_id) = max_dates.min_id
                                        AND GREATEST(cha.sender_id, cha.resiver_id) = max_dates.max_id
                                        AND cha.date = max_dates.max_date
                                        ORDER BY cha.id DESC;`);
    return chat_data;
}



router.get("/list", auth, async(req, res)=>{
    try {
        const uname = await DataFind(`SELECT COALESCE(sit.title, '') as title
                                        FROM tbl_admin as adr
                                        LEFT JOIN tbl_sitter as sit ON adr.country_code = sit.country_code AND adr.phone = sit.phone
                                        WHERE adr.id = '${req.user.admin_id}'`);

        const chat_data = await chatuserlist(req.user.admin_id);

        let chatListPromises = chat_data.map(async (cdata) => {
            let newcheck = await unreadcheck(cdata.sender_id, cdata.resiver_id, '3');
            cdata.status = newcheck;
            cdata.date = storytime(cdata.date);

            if (cdata.u_name.length > 22) {
                cdata.u_name = cdata.u_name.slice(0, 21) + '...';
            }
            if (cdata.message.length > 22) {
                cdata.message = cdata.message.slice(0, 21) + '...';
            }

            return cdata;
        });

        let chat_list = await Promise.all(chatListPromises);


        if (chat_list != "") {
            let lastuser = chat_list[chat_list.length - 1];

            if (await DataUpdate(`tbl_chat_new`,
                `scheck = '0'`,
                `(sender = '${lastuser.sender_id}' AND receiver = '${lastuser.resiver_id}') OR (sender = '${lastuser.resiver_id}' AND receiver = '${lastuser.sender_id}')`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                res.redirect("/valid_license");
            }

            chat_list[chat_list.length - 1].status = 0;
            
        }


        
        let first_chat = chat_list[0];

        let user = "", all_chat = [], chat_detail = "", last_data = "", send_id = 0;
        if (first_chat != undefined) {

            chat_detail = await DataFind(`SELECT * FROM tbl_chat 
                                            WHERE (sender_id = '${first_chat.sender_id}' AND resiver_id = '${first_chat.resiver_id}')
                                            OR (sender_id = '${first_chat.resiver_id}' AND resiver_id = '${first_chat.sender_id}')  `);
                                            
            if (chat_detail == "") {
                first_chat = chat_list[1];
                chat_detail = await DataFind(`SELECT * FROM tbl_chat 
                                                WHERE (sender_id = '${first_chat.sender_id}' AND resiver_id = '${first_chat.resiver_id}')
                                                OR (sender_id = '${first_chat.resiver_id}' AND resiver_id = '${first_chat.sender_id}')  `);
                
            }
            
            if (req.user.admin_id == first_chat.sender_id) {
                user = await DataFind(`SELECT name FROM tbl_admin WHERE id = '${first_chat.resiver_id}'`);
            } else {
                user = await DataFind(`SELECT name FROM tbl_admin WHERE id = '${first_chat.sender_id}'`);
            }
            
            chat_detail.forEach(item => {
                const dateString = new Date(item.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                
                let existingDateEntry = all_chat.find(entry => entry.date === dateString);
                
                if (!existingDateEntry) {
                    existingDateEntry = {
                        date: dateString,
                        chat: []
                    };
                    all_chat.push(existingDateEntry);
                }
                
                const fdate = formatAMPM(new Date(item.date));
                existingDateEntry.chat.push({
                    id: item.id,
                    date: fdate,
                    message: item.message.replace(/\n/g, '<br>'),
                    status: item.sender_id == req.user.admin_id ? 1 : 2
                });
            });
    
            let last = all_chat[all_chat.length -1 ];
            last_data = last.chat[last.chat.length - 1].date;

            if (first_chat.sender_id == req.user.admin_id) {
                send_id = first_chat.resiver_id;
            } else {
                send_id = first_chat.sender_id;
            }
        }

        let mid = "";

        res.render("chat", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, uname, chat_list, all_chat, user, last_data, send_id, mid
        });
    } catch (error) {
        console.log(error);
    }
});



router.post("/chat_list", auth, async(req, res)=>{
    try {
        const {id} = req.body;

        const chat_data = await DataFind(`SELECT cn.*, tcn.id as uid
                                            FROM tbl_chat as cn
                                            JOIN tbl_chat_new as tcn ON (
                                                (tcn.sender = cn.sender_id AND tcn.receiver = cn.resiver_id) OR (tcn.receiver = cn.sender_id AND tcn.sender = cn.resiver_id)
                                            )
                                            WHERE cn.id = '${id}'`);

        if (await DataUpdate(`tbl_chat_new`, `scheck = '0'`, `id = '${chat_data[0].uid}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            res.redirect("/valid_license");
        }

        let first_chat = chat_data[0], user = "", send_id = 0;

        if (first_chat.sender_id == req.user.admin_id) {
            send_id = first_chat.resiver_id;
        } else {
            send_id = first_chat.sender_id;
        }


        if (req.user.admin_id == first_chat.sender_id) {
            user = await DataFind(`SELECT name FROM tbl_admin WHERE id = '${first_chat.resiver_id}'`);
        } else {
            user = await DataFind(`SELECT name FROM tbl_admin WHERE id = '${first_chat.sender_id}'`);
        }

        const chat_detail = await DataFind(`SELECT * FROM tbl_chat 
                                        WHERE (sender_id = '${first_chat.sender_id}' AND resiver_id = '${first_chat.resiver_id}')
                                        OR (sender_id = '${first_chat.resiver_id}' AND resiver_id = '${first_chat.sender_id}')  `);
        
        const all_chat = [];
        chat_detail.forEach(item => {
            const dateString = new Date(item.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            
            let existingDateEntry = all_chat.find(entry => entry.date === dateString);
            
            if (!existingDateEntry) {
                existingDateEntry = {
                    date: dateString,
                    chat: []
                };
                all_chat.push(existingDateEntry);
            }
            
            const fdate = formatAMPM(new Date(item.date));
            existingDateEntry.chat.push({
                id: item.id,
                date: fdate,
                message: item.message.replace(/\n/g, '<br>'),
                status: item.sender_id == req.user.admin_id ? 1 : 2
            });
        });

        let last = all_chat[all_chat.length -1 ];
        let last_data = last.chat[last.chat.length - 1].date;

        res.send({ user, last_data, all_chat, send_id });
    } catch (error) {
        console.log(error);
    }
});





router.post("/chat_save", async(req, res)=>{
    try {
        const {uid, userId, message} = req.body;

        const all_chat = await DataFind(`SELECT * FROM tbl_chat_new 
                                            WHERE (sender = '${uid}' AND receiver = '${userId}') OR (sender = '${userId}' AND receiver = '${uid}') `);

        if (all_chat != "") {
            if (await DataUpdate(`tbl_chat_new`, `c_check = '1'`,
                                `(sender = '${uid}' AND receiver = '${userId}') OR (sender = '${userId}' AND receiver = '${uid}')`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                res.redirect("/valid_license");
            }

        } else {
            if (await DataInsert(`tbl_chat_new`, `sender, receiver, scheck, c_check`, `'${uid}', '${userId}', '0', '1'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                res.redirect("/valid_license");
            }
        }



        const chat_check = await DataFind(`SELECT * FROM tbl_chat
                                            WHERE (sender_id = '${uid}' AND resiver_id = '${userId}') OR (sender_id = '${userId}' AND resiver_id = '${uid}') 
                                            ORDER BY id DESC LIMIT 1 `);

        let ndate = new Date().toISOString();
        const emessage = mysql.escape(message);

        let today_date = "0";
        if (chat_check == "") {
            const dateString = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            today_date = dateString;
            

            if (await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${uid}', '${userId}', '${ndate}', 'Hello 👋'`, req.hostname, req.protocol) == -1) {
    
                req.flash('errors', process.env.dataerror);
                res.redirect("/valid_license");
            }

            if (await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${uid}', '${userId}', '${ndate}', ${emessage}`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                res.redirect("/valid_license");
            }
        } else {
            
            let cdate = new Date(chat_check[0].date);
            let ctoday = new Date();
            cdate.setHours(0, 0, 0, 0);
            ctoday.setHours(0, 0, 0, 0);

            if (cdate.getTime() != ctoday.getTime()) {
                const dateString = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                today_date = dateString;
            }

            if (await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${uid}', '${userId}', '${ndate}', ${emessage}`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                res.redirect("/valid_license");
            }
            
        }

        const chat_data = await chatuserlist(uid);

        let chatListPromises = chat_data.map(async (cdata) => {
            let newcheck = await unreadcheck(cdata.sender_id, cdata.resiver_id, '3');
            cdata.status = newcheck;
            cdata.date = storytime(cdata.date);

            if (cdata.u_name.length > 22) {
                cdata.u_name = cdata.u_name.slice(0, 21) + '...';
            }
            if (cdata.message.length > 22) {
                cdata.message = cdata.message.slice(0, 21) + '...';
            }

            return cdata;
        });

        let chat_list = await Promise.all(chatListPromises);

        // // OneSignal
        sendOneNotification(message, 'customer', userId);

        res.status(200).json({ message: 'Message Send successful', status:true, today_date, chat_list });
    } catch (error) {
        console.error(error);
    }
});


router.post("/real_time", async(req, res)=>{
    try {
        const {uid, cuid, userId, today, already_read} = req.body;

        if (already_read == "1") {

            if (await DataUpdate(`tbl_chat_new`, `scheck = '0'`,
                `(sender = '${cuid}' AND receiver = '${userId}') OR (sender = '${userId}' AND receiver = '${cuid}')`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                res.redirect("/valid_license");
            }
        }

        let today_date = "0";
        if (today == "") {
            
            const chat_check = await DataFind(`SELECT * FROM tbl_chat 
                                                WHERE (sender_id = '${cuid}' AND resiver_id = '${userId}') OR (sender_id = '${userId}' AND resiver_id = '${cuid}') 
                                                ORDER BY id DESC LIMIT 1 `);
    
            if (chat_check != "") {
                
                let cdate = new Date(chat_check[0].date);
                let ctoday = new Date();
                cdate.setHours(0, 0, 0, 0);
                ctoday.setHours(0, 0, 0, 0);
        
                if (cdate.getTime() != ctoday.getTime()) {
                    const dateString = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                    today_date = dateString;
                }
            } else {
                const dateString = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                today_date = dateString;
            }

        } else {
            today_date = today;
        }

        const chat_data = await chatuserlist(uid);

        let chatListPromises = chat_data.map(async (cdata) => {
            let newcheck = await unreadcheck(cdata.sender_id, cdata.resiver_id, '3');
            cdata.status = newcheck;
            cdata.date = storytime(cdata.date);

            if (cdata.u_name.length > 22) {
                cdata.u_name = cdata.u_name.slice(0, 21) + '...';
            }
            if (cdata.message.length > 22) {
                cdata.message = cdata.message.slice(0, 21) + '...';
            }

            return cdata;
        });

        let chat_list = await Promise.all(chatListPromises);

        // console.log(chat_list);

        res.send({ list:chat_list, today_date });
    } catch (error) {
        console.log(error);
    }
});





module.exports = router;
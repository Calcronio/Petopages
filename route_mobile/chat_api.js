/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const express = require("express");
const router = express.Router();
let mysql = require('mysql');
const sendOneNotification = require("../middleware/send");
const { DataFind, DataInsert, DataUpdate } = require("../middleware/database_query");

// ============= Chat ================ //

function formatAMPM(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
}

function storytime(utime) {
    const currentTime = new Date();
    const storyTime = new Date(utime);

    const timeDifference = currentTime - storyTime;
    const hours = Math.floor(timeDifference / (1000 * 60 * 60));
    const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
    
    let dtime = 0;
    if (hours == "0" && minutes == "0") {
        const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);
        if (seconds == "0") dtime = `1s`;
        else dtime = `${seconds}s`;
    } else if (hours == "0" && minutes != "0") {
        dtime = `${minutes}m`;
    } else {
        dtime = `${hours}h`;
    }
    return dtime;
}

async function userList(id, status) {
    let chat_data;
    if (status == "3") {
        chat_data = await DataFind(`SELECT cha.*, COALESCE(adr.name, '') as u_name
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
                                        ORDER BY cha.date DESC;`);
    } else {
        
        chat_data = await DataFind(`SELECT cha.*, COALESCE(sit.title, '') as u_name, COALESCE(sit.logo, '') as s_logo
                                        FROM tbl_chat as cha 
                                        LEFT JOIN tbl_admin as adr ON (
                                          (cha.resiver_id != ${id} AND cha.resiver_id = adr.id) OR
                                          (cha.sender_id != ${id} AND cha.sender_id = adr.id)
                                        )
                                        LEFT JOIN tbl_sitter as sit ON adr.country_code = sit.country_code AND adr.phone = sit.phone
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
                                        ORDER BY cha.date DESC;`);
    }
    return chat_data;
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

router.post("/all_chat", async(req, res)=>{
    try {
        const {id} = req.body;
        if (id == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${id}'`);
        if (admin_data == "") return res.status(200).json({ message: 'User Not Found!', status:false});

        let chat_list;
        if (admin_data[0].role == "2") {

            let chat_data = await userList(id, '2');
                    
            let chatListPromises = chat_data.map(async (cdata) => {

                let newcheck = await unreadcheck(cdata.sender_id, cdata.resiver_id, '2');
                cdata.status = newcheck;
                cdata.date = storytime(cdata.date);
                return cdata;
            });

            chat_list = await Promise.all(chatListPromises);

        } else if (admin_data[0].role == "3") {

            let chat_data = await userList(id, '3');

            let chatListPromises = chat_data.map(async (cdata) => {

                let newcheck = await unreadcheck(cdata.sender_id, cdata.resiver_id, '3');
                console.log(newcheck);

                cdata.status = newcheck;
                cdata.date = storytime(cdata.date);
                return cdata;
            });

            chat_list = await Promise.all(chatListPromises);
        }        

        res.status(200).json({ message: 'Data load successful', status:true, chat_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





router.post("/save_chat", async(req, res)=>{
    try {
        const {sender_id, recevier_id, message, status} = req.body;
        if (sender_id == "" || recevier_id == "" || message == "", status == "") return res.status(200).json({ message: 'Data Not Found!', status:false});

        if (sender_id == recevier_id) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        // Check Message Read
        const chat_data = await DataFind(`SELECT * FROM tbl_chat_new 
                                            WHERE (sender = '${sender_id}' AND receiver = '${recevier_id}') OR (sender = '${recevier_id}' AND receiver = '${sender_id}') `);

        if (chat_data != "") {

            if (status == "2") {

                if (await DataUpdate(`tbl_chat_new`, `scheck = '1'`,
                    `(sender = '${sender_id}' AND receiver = '${recevier_id}') OR (sender = '${recevier_id}' AND receiver = '${sender_id}')`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                }
            } else {
                if (await DataUpdate(`tbl_chat_new`, `c_check = '1'`,
                    `(sender = '${sender_id}' AND receiver = '${recevier_id}') OR (sender = '${recevier_id}' AND receiver = '${sender_id}')`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                }
            }

        } else {

            if (status == "2") {
                if (await DataInsert(`tbl_chat_new`, `sender, receiver, scheck, c_check`, `'${recevier_id}', '${sender_id}', '1', '0'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                }
            } else {
                if (await DataInsert(`tbl_chat_new`, `sender, receiver, scheck, c_check`, `'${sender_id}', '${recevier_id}', '0', '1'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                }
            } 
        }

        const chat_check = await DataFind(`SELECT * FROM tbl_chat
                                            WHERE (sender_id = '${sender_id}' AND resiver_id = '${recevier_id}') OR (sender_id = '${recevier_id}' AND resiver_id = '${sender_id}') 
                                            ORDER BY id DESC LIMIT 1 `);



        // Message Save
        let ndate = new Date().toISOString();
        let today_date = "0";
        const emessage = mysql.escape(message);
        if (chat_check == "") {
            const dateString = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            today_date = dateString;
            
            if (await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${sender_id}', '${recevier_id}', '${ndate}', 'Hello 👋'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            } else {
                await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${sender_id}', '${recevier_id}', '${ndate}', ${emessage}`);
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

            if (await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${sender_id}', '${recevier_id}', '${ndate}', ${emessage}`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
        }

        // OneSignal
        if (status == "2") {
            sendOneNotification(message, 'sitter', recevier_id);
        } else {
            sendOneNotification(message, 'customer', recevier_id);
        }

        res.status(200).json({ message: 'Message Save successful', status:true, data: { userId: recevier_id, uid: sender_id, date: formatAMPM(new Date()), today: today_date, messages:message } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/chat_data", async(req, res)=>{
    try {
        const { sid, sender_id, recevier_id} = req.body;
        if (sender_id == "" || recevier_id == "" || sid == "") return res.status(200).json({ message: 'Data Not Found!', status:false});

        if (sender_id == recevier_id) return res.status(200).json({ message: 'Invaild Id Found!', status:false});

        let user;
        if (sid == sender_id) {
            user = await DataFind(`SELECT name FROM tbl_admin WHERE id = '${recevier_id}'`);
        } else {
            user = await DataFind(`SELECT name FROM tbl_admin WHERE id = '${sender_id}'`);
        }

        const chat_data = await DataFind(`SELECT * FROM tbl_chat 
                                        WHERE (sender_id = '${sender_id}' AND resiver_id = '${recevier_id}')
                                        OR (sender_id = '${recevier_id}' AND resiver_id = '${sender_id}')  `);

        console.log(chat_data);
        
        const all_chat = [];
        chat_data.forEach(item => {
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
                message: item.message,
                status: item.sender_id == sid ? 1 : 2
            });
        });
        
        // console.log(all_chat);
        
        res.status(200).json({ message: 'Data load successful', status:true, user:user[0], all_chat });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





router.post("/message_read", async(req, res)=>{
    try {
        const {cuid, userId, status} = req.body;
        if (cuid == "" || userId == "" || status == "") return res.status(200).json({ message: 'Data Not Found!', status:false});

        if (status == "2") {
            if (await DataUpdate(`tbl_chat_new`, ` c_check = '0'`, `(sender = '${cuid}' AND receiver = '${userId}') OR (sender = '${userId}' AND receiver = '${cuid}')`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
        } else {

            if (await DataUpdate(`tbl_chat_new`, `scheck = '0'`, `(sender = '${cuid}' AND receiver = '${userId}') OR (sender = '${userId}' AND receiver = '${cuid}')`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
        }

        res.send({ message: 'Message Read successful', status:true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



module.exports = router;
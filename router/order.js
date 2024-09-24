/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const multer  = require('multer');
let mysql = require('mysql');
const sendOneNotification = require("../middleware/send");
const { DataFind, DataInsert, DataUpdate } = require("../middleware/database_query");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/service proof");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const upload = multer({storage : storage});

router.get("/list", auth, async(req, res)=>{
    try {
        let order_data;
        if (req.user.admin_role == "1") {
            order_data = await DataFind(`SELECT ord.id, ord.order_id, ord.date, ord.status, ord.tot_price, ord.reject_reason, ord.date_status,
                                        COALESCE(cusa.name, '') as cus_name,
                                        COALESCE(siad.name, '') as sitt_name,
                                        COALESCE(ser.name, '') as service_name,
                                        COALESCE(sta.name, '') as sta_name,
                                        COALESCE(sp.id, '') as pid,
                                        COALESCE(sr.review, '') as review, COALESCE(sr.star_no, '') as rating
                                        FROM tbl_order ord
                                        LEFT join tbl_admin cusa on ord.customer_id = cusa.id
                                        LEFT join tbl_admin siad on ord.sitter_id = siad.id
                                        LEFT join tbl_services ser on ord.service_id = ser.id 
                                        LEFT join tbl_status_list sta on ord.status = sta.id
                                        LEFT join tbl_service_proof sp on ord.id = sp.order_id
                                        LEFT join tbl_sitter_reviews sr on ord.id = sr.order_id
                                        ORDER BY ord.id DESC`);
            
        } else {
            
            order_data = await DataFind(`SELECT ord.id, ord.order_id, ord.date, ord.status, ord.tot_price, ord.site_commisiion, ord.reject_reason, ord.date_status,
                                        COALESCE(cusa.name, '') as cus_name,
                                        COALESCE(siad.name, '') as sitt_name,
                                        COALESCE(ser.name, '') as service_name,
                                        COALESCE(sta.name, '') as sta_name,
                                        COALESCE(sp.id, '') as pid,
                                        COALESCE(sr.review, '') as review, COALESCE(sr.star_no, '') as rating
                                        FROM tbl_order ord
                                        LEFT join tbl_admin cusa on ord.customer_id = cusa.id
                                        LEFT join tbl_admin siad on ord.sitter_id = siad.id
                                        LEFT join tbl_services ser on ord.service_id = ser.id 
                                        LEFT join tbl_status_list sta on ord.status = sta.id
                                        LEFT join tbl_service_proof sp on ord.id = sp.order_id
                                        LEFT join tbl_sitter_reviews sr on ord.id = sr.order_id
                                        WHERE ord.sitter_id = '${req.user.admin_id}' ORDER BY ord.id DESC`);

            order_data.map(oval => {
                oval.tot_price = (parseFloat(oval.tot_price) - parseFloat(oval.site_commisiion)).toFixed(2);
                return oval;
            });
            
        }

        const Status = await DataFind(`SELECT * FROM tbl_status_list`);

        const List_cancelList = [
            { "id": 1, "title": "Financing fell through"},
            { "id": 2, "title": "Inspection issues"},
            { "id": 3, "title": "Change in financial situation"},
            { "id": 4, "title": "Title issues"},
            { "id": 5, "title": "Seller changes their mind"},
            { "id": 6, "title": "Competing offer"},
            { "id": 7, "title": "Personal reason"},
            { "id": 8, "title": "Others"},
        ];

        res.render("order", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, order_data, Status, List_cancelList
        });
    } catch (error) {
        console.log(error);
    }
});



function getfulltime() {
    let date = new Date();
    let day = (date.getDate() < 10 ? '0'+date.getDate() : date.getDate());
    let month = (date.getMonth()+1 < 10 ? '0'+(date.getMonth()+1) : date.getMonth()+1);
    let year = date.getFullYear();
    let hours = (date.getHours() % 12 || 12);
    let minutes = (date.getMinutes() < 10 ? '0'+date.getMinutes() : date.getMinutes());
    let ampm = (date.getHours() >= 12) ? 'PM' : 'AM';
    return `${year}-${month}-${day} | ${hours}:${minutes} ${ampm}`;
}

function formatfulldate() {
    let date = new Date();
    let day = (date.getDate() < 10 ? '0'+date.getDate() : date.getDate());
    let month = (date.getMonth()+1 < 10 ? '0'+(date.getMonth()+1) : date.getMonth()+1);
    let year = date.getFullYear();
    return `${year}-${month}-${day}`;
}

async function sendnotification(oid, cid, sid, status, hostname, protocol) {
    if (await DataInsert(`tbl_notification`, `order_id, c_id, s_id, date, status`, `'${oid}', '${cid}', '${sid}', '${getfulltime()}', '${status}'`, hostname, protocol) == -1) {
        return -1;
    }
}

router.post("/approved", auth, async(req, res)=>{
    try {
        const {id} = req.body;

        const Status = await DataFind(`SELECT * FROM tbl_status_list`);

        if (await DataUpdate(`tbl_order`, `status = '${Status[1].id}', date_status = '1'`, `id = '${id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        const order_data = await DataFind(`SELECT id, customer_id, sitter_id FROM tbl_order WHERE id = '${id}'`);
        // Notification
        if (sendnotification(order_data[0].id, order_data[0].customer_id, order_data[0].sitter_id, Status[1].id, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        // OneSignal
        sendOneNotification(Status[1].notifi_text, 'customer', order_data[0].customer_id);

        req.flash('success', `${Status[1].name} successfully`);
        res.send({status:true});
    } catch (error) {
        console.log(error);
    }
});

router.post("/unapproved", auth, async(req, res)=>{
    try {
        const {order_id, cancel_reason} = req.body;

        const Status = await DataFind(`SELECT * FROM tbl_status_list`);

        const unorder = await DataFind(`SELECT ord.id, ord.customer_id, ord.sitter_id, ord.date_time, ord.complete_date, ord.uncomplete_date, ord.un_check, 
                                        ser.price as sprice, 
                                        cus.id as cid, cus.tot_balance as cbalance
                                        FROM tbl_order as ord
                                        JOIN tbl_sitter_services as ser ON ord.subservice_id = ser.id
                                        JOIN tbl_admin as adm ON ord.customer_id = adm.id
                                        JOIN tbl_customer as cus ON adm.country_code = cus.country_code AND adm.phone = cus.phone
                                        WHERE ord.id = '${order_id}'`);

        let untotal = "", twallet = 0;
        let tdate = unorder[0].date_time.split("&!");
        for (let i = 0; i < tdate.length;){
            let check = tdate[i].split("&")[1].split(",");

            for (let a = 0; a < check.length;) {
                if (typeof untotal == "string") {
                    untotal = parseFloat(unorder[0].sprice);
                } else {
                    untotal += parseFloat(unorder[0].sprice);
                }
                a++;
            }
            i++;
        }
        
        if (untotal != "") {
            twallet += parseFloat(unorder[0].cbalance) + parseFloat(untotal);
            if (await DataUpdate(`tbl_customer`, `tot_balance = '${twallet.toFixed(2)}'`, `id = '${unorder[0].cid}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                `'${unorder[0].customer_id}', '${untotal}', '${formatfulldate()}', '0', '1', '${unorder[0].id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }

        const oreason = mysql.escape(cancel_reason);
        if (await DataUpdate(`tbl_order`, `status = '${Status[2].id}', reject_reason = ${oreason}`, `id = '${order_id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        // Notification
        if (sendnotification(unorder[0].id, unorder[0].customer_id, unorder[0].sitter_id, Status[2].id, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        // OneSignal
        sendOneNotification(Status[2].notifi_text, 'customer', unorder[0].customer_id);

        req.flash('success', `${Status[2].name} successfully`);
        res.redirect("/order/list");
    } catch (error) {
        console.log(error);
    }
});

router.post("/send_otp", auth, async(req, res)=>{
    try {
        const {id} = req.body;

        const service_otp = await DataFind(`SELECT date_time, otp_data, start_time, end_time, checked_date, current_check, complete_date, uncomplete_date FROM tbl_order WHERE id = '${id}'`);
        let date_data = service_otp[0].date_time.split('&!');

        let date = new Date();
        let day = (date.getDate() < 10 ? '0'+date.getDate() : date.getDate());
        let month = (date.getMonth()+1 < 10 ? '0'+(date.getMonth()+1) : date.getMonth()+1);
        let year = date.getFullYear();
        let fulldate = `${year}-${month}-${day}`;

        let checked_date = [], current_check = "", current_id = [], undate = [];
        
        if (!service_otp[0].checked_date || service_otp[0].checked_date != "") {

            let check_first = 0, uncheckid = [];

            let che_date = service_otp[0].checked_date.split('&&!');
            let udata = service_otp[0].uncomplete_date;

            if (service_otp[0].current_check == "") {
                
                for (let a = 0; a < che_date.length;){
                    let cdate = che_date[a].split("&!");
    
                    if (fulldate <= cdate[0]) {
                        if (check_first == 0) {
                            current_check = che_date[a];
                            current_id = cdate[1].split("&");
                            check_first = 1;
                        } else {
    
                            checked_date.push(che_date[a]);
                        }
    
                    } else {
                            
                        if (udata == "" || udata === null) {
                            let uspl = cdate[1].split("&");
                            uncheckid = uncheckid == "" ? uspl : uncheckid.concat(uspl);
                            
                        } else {
                            
                            let oldundate = udata.split(",");
                            let newundata = oldundate.concat(cdate[1].split("&"));
                            
                            uncheckid = uncheckid == "" ? newundata : uncheckid.concat(newundata);
                        }
                    }
                    a++;
                }
                
                if (udata == "" || udata === null) {
                    undate = uncheckid;
                } else {
                    let oid = udata.split(",");
                    undate = uncheckid == "" ? oid : oid.concat(uncheckid);
                }
                
                let duncdata = undate.join(",");
                if (await DataUpdate(`tbl_order`, `checked_date = '${checked_date.join('&&!')}', current_check = '${current_check}', uncomplete_date = '${duncdata}'`,
                    `id = '${id}'`, req.hostname, req.protocol) == -1) {
        
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }
                
            } else {
                
                let current = service_otp[0].current_check.split("&!");
                let old_un = service_otp[0].uncomplete_date;
                
                if (fulldate <= current[0]) {
                    current_id = current[1].split("&");
                    undate = old_un.split(",");
                    
                } else {
                    
                    if (old_un != "") {
                        let old = old_un.split(",");
                        undate = old.concat(current[1].split("&"));
                    } else {
                        undate = current[1].split("&");
                    }
                    
                    if (che_date != "") {
                        for (let c = 0; c < che_date.length;){
                            let cdate = che_date[c].split("&!");
            
                            if (fulldate <= cdate[0]) {
                                if (check_first == 0) {
                                    current_check = che_date[c];
                                    current_id = cdate[1].split("&");
                                    check_first = 1;
                                } else {
            
                                    checked_date.push(che_date[c]);
                                }
                            } else {
                                let udata = service_otp[0].uncomplete_date;
                                    
                                if (udata == "" || udata === null) {
                                    let uspl = cdate[1].split("&");
                                    undate = undate.concat(uspl);
                                    
                                } else {
                                    
                                    let newundata = cdate[1].split("&");
                                    undate = undate.concat(newundata);
                                }
                            }
                            c++;
                        }
                    }

                    if (await DataUpdate(`tbl_order`, `checked_date = '${checked_date.join('&&!')}', current_check = '${current_check}', uncomplete_date = '${undate.join(",")}'`,
                        `id = '${id}'`, req.hostname, req.protocol) == -1) {
        
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }
                }
            }
        }
        
        let complete_time = service_otp[0].complete_date;
        let cutime = [];
        if (complete_time != "" || complete_time != undefined) {
            cutime = complete_time.split(",");
        }

        let all_date = [];
        for (let i = 0; i < date_data.length;){
            let dtime = date_data[i].split("&");
            const date_time = await DataFind(`SELECT * FROM tbl_date_time WHERE id IN (${dtime[1]})`);

            let check_date = [];
            for (let b = 0; b < date_time.length;) {
                let chid = (date_time[b].id).toString();

                if (undate.includes(chid) === true) {
                    check_date.push({ ...date_time[b], status: '3' });
                } else if (current_id.includes(chid) === true) {
                    check_date.push({ ...date_time[b], status: '2' });
                } else if (cutime.includes(chid) === true) {
                    check_date.push({ ...date_time[b], status: '1' });
                } else {
                    check_date.push({ ...date_time[b], status: '0' });
                }
                b++;
            }

            let onefulldate = {
                date : dtime[0],
                times : check_date
            };
            all_date.push(onefulldate);
            i++;
        }

        if (current_id == "") {

            const Status = await DataFind(`SELECT * FROM tbl_status_list`);

            const unorder = await DataFind(`SELECT ord.id, ord.customer_id, ord.complete_date, ord.uncomplete_date, ord.un_check, ser.price as sprice, 
                                            cus.id as cid, cus.tot_balance as cbalance
                                            FROM tbl_order as ord
                                            JOIN tbl_sitter_services as ser ON ord.subservice_id = ser.id
                                            JOIN tbl_admin as adm ON ord.customer_id = adm.id
                                            JOIN tbl_customer as cus ON adm.country_code = cus.country_code AND adm.phone = cus.phone
                                            WHERE ord.id = '${id}'`);

            let untotal = "";
            if (unorder[0].uncomplete_date != "") {

                let unid = unorder[0].uncomplete_date.split(',');
                let undate = unorder[0].un_check != "" ? unorder[0].un_check.split(',') : '';

                unid.map(udata => {
                    if (undate != "") {
                        if (undate.includes(udata) === false) {
                            if (untotal == "") {
                                untotal = parseFloat(unorder[0].sprice);
                            } else {
                                untotal += parseFloat(unorder[0].sprice);
                            }
                        }
                    }
                    if (undate == "") {
                        if (untotal == "") {
                            untotal = parseFloat(unorder[0].sprice);
                        } else {
                            untotal += parseFloat(unorder[0].sprice);
                        }
                    }
                });
                let twallet = parseFloat(unorder[0].cbalance) + parseFloat(untotal);

                if (await DataUpdate(`tbl_customer`, `tot_balance = '${twallet.toFixed(2)}'`, `id = '${unorder[0].cid}'`, req.hostname, req.protocol) == -1) {
        
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }

                if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                    `'${unorder[0].customer_id}', '${untotal}', '${formatfulldate()}', '0', '1', '${unorder[0].id}'`, req.hostname, req.protocol) == -1) {
        
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }

            }

                if (unorder[0].complete_date != "") {
                    if (await DataUpdate(`tbl_order`, `status = '${Status[5].id}', diff_amount = '${untotal}', otp_data = '', date_status = '0'`,
                        `id = '${id}'`, req.hostname, req.protocol) == -1) {
        
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }

                } else {
                    if (await DataUpdate(`tbl_order`, `status = '${Status[2].id}', diff_amount = '${untotal}', reject_reason = 'Service Not Attending', otp_data = '', date_status = '0'`,
                        `id = '${id}'`, req.hostname, req.protocol) == -1) {
        
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }
                }

            return res.send({id, all_date});
        }

        if (service_otp[0].otp_data == "" && current_id != "") {
            
            let otp_result = '';
            let characters = '0123456789';
            let charactersLength = characters.length;
            for (let i = 0; i < 6; i++) {
                otp_result += characters.charAt(Math.floor(Math.random() * charactersLength));
            }
            if (await DataUpdate(`tbl_order`, `otp_data = '${otp_result}'`, `id = '${id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            return res.send({id, all_date});
            
        } else {
            return res.send({id, all_date});
        }
    } catch (error) {
        console.log(error);
    }
});

router.post("/otpcheck", auth, async(req, res)=>{
    try {
        const {id, newotp } = req.body;

        const books = await DataFind(`SELECT otp_data FROM tbl_order WHERE id = '${id}'`);
        if (books != "") {
            if (books[0].otp_data == newotp) {
                return res.send({ status:true });
            } else {
                return res.send({ status:false });
            }
        } else {
            return res.send({ status:false });
        }
    } catch (error) {
        console.log(error);
    }
});



async function sendChat({cus, sitter, onetime, sname, onedate, message, hostname, protocol}) {

    const dt = await DataFind(`SELECT * FROM tbl_date_time WHERE id IN (${onetime})`);

    let mess = `⏰ The ${sname} ${message} at `;
    dt.map((d, i) => {
        if (i == "0") mess += `${d.time}`;
        else mess += ` & ${d.time}` ;
    });
    mess += `, ${onedate}`;

    const chat_check = await DataFind(`SELECT * FROM tbl_chat WHERE (sender_id = '${sitter}' AND resiver_id = '${cus}') OR (sender_id = '${cus}' AND resiver_id = '${sitter}');
                                        ORDER BY id DESC LIMIT 1 `);

    let fdate = new Date().toISOString(), messa = "";
    if (chat_check == "") {

        const sitterg = await DataFind(`SELECT defaultm FROM tbl_sitter_setting WHERE sitter_id = '${sitter}'`);
        if (sitterg != "") {
            messa = sitterg[0].defaultm;

            if(sitterg[0].defaultm != "") {
                if (await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${sitter}', '${cus}', '${fdate}', '${sitterg[0].defaultm}'`, hostname, protocol) == -1) {
                    return -1;
                }
            }
        } else {
            messa = "Hello 👋";

            if (await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${sitter}', '${cus}', '${fdate}', '${messa}'`, hostname, protocol) == -1) {
                return -1;
            }
        }
        if (messa != "") sendOneNotification(messa, 'customer', cus);

        let sdate = new Date().toISOString();
        if (await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${sitter}', '${cus}', '${sdate}', '${mess}'`, hostname, protocol) == -1) {
            return -1;
        }
        
    } else {

        if (await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${sitter}', '${cus}', '${fdate}', '${mess}'`, hostname, protocol) == -1) {
            return -1;
        }
    }
    sendOneNotification(mess, 'customer', cus);
    return;
}

router.post("/service_start", auth, async(req, res)=>{
    try {
        const {service_id} = req.body;

        const Status = await DataFind(`SELECT * FROM tbl_status_list`);
        const order_data = await DataFind(`SELECT ord.id, ord.customer_id, ord.sitter_id, ord.start_time, ord.current_check,
                                            COALESCE(servi.name, "") as sname
                                            FROM tbl_order as ord
                                            LEFT JOIN tbl_services AS servi ON ord.service_id = servi.id
                                            WHERE ord.id = '${service_id}'`);

        let ser =  order_data[0];
        let onedate = ser.current_check.split("&!");
        let onetime = onedate[1].split('&');

        let fulldate;
        if (ser.start_time == "" || ser.start_time == null) {
            fulldate = `${onetime[0]}&` + getfulltime();
        } else {
            fulldate = ser.start_time + `&!${onetime[0]}&` + getfulltime();
        }

        if (await DataUpdate(`tbl_order`, `status = '${Status[3].id}', otp_data = '', start_time = '${fulldate}', date_status = '2'`, `id = '${service_id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        // Send Chat Start Service
        if (await sendChat({cus:ser.customer_id, sitter:ser.sitter_id, onetime, sname:ser.sname, onedate:onedate[0], message:"started", hostname:req.hostname, protocol:req.protocol}) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        // // Notification
        if (sendnotification(ser.id, ser.customer_id, ser.sitter_id, Status[3].id, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        // // OneSignal
        sendOneNotification(Status[3].notifi_text, 'customer', ser.customer_id);

        req.flash('success', `${Status[3].name} successfully`);
        res.redirect("/order/list");
    } catch (error) {
        console.log(error);
    }
});

router.post("/service_end", auth, async(req, res)=>{
    try {
        const {end_service_id} = req.body;
        
        const Status = await DataFind(`SELECT * FROM tbl_status_list`);

        const order_data = await DataFind(`SELECT ord.id, ord.customer_id, ord.sitter_id, ord.sitter_commission, ord.end_time, ord.current_check, ord.checked_date, ord.complete_date,
                                            COALESCE(servi.name, "") as sname
                                            FROM tbl_order as ord
                                            LEFT JOIN tbl_services AS servi ON ord.service_id = servi.id
                                            WHERE ord.id = '${end_service_id}'`);

        let ser =  order_data[0];

        let onedate = ser.current_check.split("&!");
        let onetime = onedate[1].split('&');
        let time = onetime[onetime.length - 1];

        let fulldate;
        if (ser.end_time == "" || ser.end_time == null) {
            fulldate = `${time}&` + getfulltime();
        } else {
            fulldate = ser.end_time + `&!${time}&` + getfulltime();
        }
        
        let complete = ser.complete_date != "" ? ser.complete_date.split(",") : "";
        let com_id = complete == "" || complete == null ? onetime : complete + ',' + onetime;
        
        if (ser.checked_date == "") {

            const unorder = await DataFind(`SELECT ord.id, ord.customer_id, ord.complete_date, ord.uncomplete_date, ord.un_check, ser.price as sprice, cus.id as cid, cus.tot_balance as cbalance
                                            FROM tbl_order as ord
                                            JOIN tbl_sitter_services as ser ON ord.subservice_id = ser.id
                                            JOIN tbl_admin as adm ON ord.customer_id = adm.id
                                            JOIN tbl_customer as cus ON adm.country_code = cus.country_code AND adm.phone = cus.phone
                                            WHERE ord.id = '${end_service_id}'`);
            
            let untotal = "", undate = "", twallet = 0;
            if (unorder[0].uncomplete_date != "") {
                undate = unorder[0].un_check != "" || unorder[0].un_check != null ? unorder[0].un_check.split(',') : '';

                let unid = unorder[0].uncomplete_date.split(',');
                unid.map(udata => {
                    if (undate != "") {
                        if (undate.includes(udata) === false) {
                            if (untotal == "") {
                                untotal = parseFloat(unorder[0].sprice);
                            } else {
                                untotal += parseFloat(unorder[0].sprice);
                            }
                        }
                    } 
                    if (undate == "") {
                        if (untotal == "") {
                            untotal = parseFloat(unorder[0].sprice);
                        } else {
                            untotal += parseFloat(unorder[0].sprice);
                        }
                    }
                });

                twallet += parseFloat(unorder[0].cbalance) + parseFloat(untotal);
            }
            
            const c_tot_order = await DataFind(`SELECT COUNT(*) as tot_order FROM tbl_order WHERE customer_id = '${ser.customer_id}'`);
            
            if (twallet != "0") {
                if (c_tot_order[0].tot_order == "1") {
                    twallet += parseFloat(req.general.signup_credit);
                }
                if (await DataUpdate(`tbl_customer`, `tot_balance = '${twallet.toFixed(2)}'`, `id = '${unorder[0].cid}'`, req.hostname, req.protocol) == -1) {
        
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }

                if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                    `'${unorder[0].customer_id}', '${untotal}', '${formatfulldate()}', '0', '1', '${unorder[0].id}'`, req.hostname, req.protocol) == -1) {
        
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }
            }
            
            const admin_data = await DataFind(`SELECT id, country_code, phone FROM tbl_admin WHERE id = '${ser.sitter_id}'`);
            const sitter_wallet = await DataFind(`SELECT id, wallet FROM tbl_sitter WHERE country_code = '${admin_data[0].country_code}' AND phone = '${admin_data[0].phone}' `);
            
            let tot_wallet = parseFloat(sitter_wallet[0].wallet) + parseFloat(ser.sitter_commission);

            if (await DataUpdate(`tbl_sitter`, `wallet = '${tot_wallet.toFixed(2)}'`, `id = '${sitter_wallet[0].id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            if (await DataUpdate(`tbl_order`,
                            `status = '${Status[5].id}', diff_amount = '${untotal}', otp_data = '', end_time = '${fulldate}', current_check = '', complete_date = '${com_id}',
                            un_check = '${unorder[0].uncomplete_date}', date_status = '0'`,
                            `id = '${end_service_id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            if (await sendChat({cus:ser.customer_id, sitter:ser.sitter_id, onetime, sname:ser.sname, onedate:onedate[0], message:"ended", hostname:req.hostname, protocol:req.protocol}) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            // // Notification
            if (sendnotification(ser.id, ser.customer_id, ser.sitter_id, Status[5].id, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            // // OneSignal
            sendOneNotification(Status[5].notifi_text, 'customer', ser.customer_id);
            req.flash('success', `${Status[5].name} successfully`);

        } else {

            if (await DataUpdate(`tbl_order`, `status = '${Status[4].id}', otp_data = '', end_time = '${fulldate}', current_check = '', date_status = '1', complete_date = '${com_id}'`,
                `id = '${end_service_id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            if (await sendChat({cus:ser.customer_id, sitter:ser.sitter_id, onetime, sname:ser.sname, onedate:onedate[0], message:"ended", hostname:req.hostname, protocol:req.protocol}) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            // // Notification
            if (sendnotification(order_data[0].id, order_data[0].customer_id, order_data[0].sitter_id, Status[4].id, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            // // OneSignal
            sendOneNotification(Status[4].notifi_text, 'customer', order_data[0].customer_id);
            req.flash('success', `${Status[4].name} successfully`);

        }
        res.redirect("/order/list");
    } catch (error) {
        console.log(error);
    }
});



router.get("/proof/:id", auth, async(req, res)=>{
    try {
        const proof_data = await DataFind(`SELECT * FROM tbl_service_proof WHERE order_id = '${req.params.id}'`);

        const order_data = await DataFind(`SELECT status FROM tbl_order WHERE id = '${req.params.id}'`);

        let all_proof = [];
        if (proof_data != "") {
            let aproof = proof_data[0].proof_data.split("&!/");
    
            for (let i = 0; i < aproof.length;){
                let pro_date = aproof[i].split('&/');
                let pro_title = pro_date[1].split('!/');
                let pro_image = pro_title[1].split('::/');
    
                all_proof.push({ date: pro_date[0], title: pro_title[0], image: pro_image });
                i++;
            }
        }
        res.render("order_proof", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, orderid:req.params.id, all_proof, order_data
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/uproof/:id", auth, upload.array('image'), async(req, res)=>{
    try {
        const {title} = req.body;

        const proof_data = await DataFind(`SELECT * FROM tbl_service_proof WHERE order_id = '${req.params.id}'`);

        let images;
        if (req.files) {
            images = req.files.map(img => {
                return 'uploads/service proof/' + img.filename;
            });
        }
        let allimage = images.join("::/");

        let full_data;
        if (proof_data == "") {
            full_data = `${getfulltime()}&/${title}!/${allimage}`;
            const edata = mysql.escape(full_data);

            if (await DataInsert(`tbl_service_proof`, `order_id, proof_data`, `'${req.params.id}', ${edata}`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

        } else {
            full_data = proof_data[0].proof_data + `&!/${getfulltime()}&/${title}!/${allimage}`;
            const edatas = mysql.escape(full_data);
            
            if (await DataUpdate(`tbl_service_proof`, `proof_data = ${edatas}`, `id = '${proof_data[0].id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }

        const order_data = await DataFind(`SELECT ord.customer_id, ord.pet, COALESCE(adm.name, "") as sname
                                            FROM tbl_order AS ord
                                            LEFT JOIN tbl_admin AS adm ON ord.sitter_id = adm.id
                                            where ord.id = '${req.params.id}'`);

        let allp = order_data[0].pet.split(","), pdata = "";
        if (allp != "") {
            for (let i = 0; i < allp.length; ){
                const data = await DataFind(`SELECT name FROM tbl_pet_detail where id = ${allp[i]}`);
                pdata += pdata == "" ? data[0].name : "," + data[0].name;
                i++;
            }
        }

        // OneSignal
        let ndata = `Good news! ${order_data[0].sname} has just uploaded a new report card for ${pdata}. You can now review the latest update on how ${pdata} is doing, including their activities, behavior, and any other important notes. To view the report card, simply log into your account and check the "Booking Details" section. Thank you for choosing our service!`;

        sendOneNotification(ndata, 'customer', order_data[0].customer_id);
        
        req.flash('success', `Upload successfully`);
        res.redirect("/order/proof/" + req.params.id);
    } catch (error) {
        console.log(error);
    }
});



function splitDate(dateString) {
   	return dateString ? dateString.split(',') : '';
}

router.get("/details/:id", auth, async(req, res)=>{
    try {
        const order_detail = await DataFind(`SELECT ord.*, 
                                                sta.name as order_status,
                                                sitt.name AS sitter_name, sitt.logo as sitter_logo,
                                                ser.service_type AS sub_sname, ser.price as service_price, ser.price_type AS price_type,
                                                servi.name as service_name,
                                                ssetting.extra_pet_charge as ex_pet_charge

                                                FROM tbl_order AS ord

                                                JOIN tbl_status_list AS sta ON ord.status = sta.id
                                                JOIN tbl_admin AS sadmin ON ord.sitter_id = sadmin.id
                                                JOIN tbl_sitter AS sitt ON sadmin.country_code = sitt.country_code AND sadmin.phone = sitt.phone
                                                JOIN tbl_sitter_services AS ser ON ord.subservice_id = ser.id
                                                JOIN tbl_services AS servi ON ord.service_id = servi.id
                                                JOIN tbl_sitter_setting ssetting ON ord.sitter_id = ssetting.sitter_id
                                                WHERE ord.id = '${req.params.id}'`);

        let online_payment = "" , online_amount = "", wallet_payment = "", wallet_amount = "", payment_detail;

        let aorderd = order_detail[0];

        if (req.user.admin_role != "1") {
            aorderd.tot_price = (parseFloat(aorderd.tot_price) - parseFloat(aorderd.site_commisiion)).toFixed(2);
        }
        
        if (aorderd.payment_type != "0" && aorderd.wallet_type != "0") {

            payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '${aorderd.payment_type}'`);

            let wamount = parseFloat(aorderd.tot_price) - parseFloat(aorderd.wallet_amount);
            online_payment = payment_detail[0].name;
            online_amount = wamount.toFixed(2);

            wallet_payment = "1";
            wallet_amount = aorderd.wallet_amount;
            
        } else if (aorderd.wallet_type == "0") {
            
            payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '${aorderd.payment_type}'`);

            online_payment = payment_detail[0].name;
            online_amount = aorderd.tot_price;

            wallet_payment = "0";
            wallet_amount = aorderd.wallet_amount;

        } else if (aorderd.payment_type == "0") {

            online_payment = "0";
            online_amount = "0";

            wallet_payment = "1";
            wallet_amount = aorderd.wallet_amount;
        }
        
        const Address_data = await DataFind(`SELECT house_no, address, landmark, address_as, country_code, phone, google_address, instruction FROM tbl_customer_address WHERE id = '${aorderd.address}'`);
        
        const pet_data = await DataFind(`SELECT image, name FROM tbl_pet_detail WHERE id IN (${aorderd.pet})`);
        
        let full_date = aorderd.date_time.split("&!");

        let cstart = aorderd.start_time;
        let start = cstart == '' ? '' : cstart.split('&!');

        let cend = aorderd.end_time;
        let end = cend == '' ? '' : cend.split('&!');

        let current = [];
        if (aorderd.current_check != "") {
            current = aorderd.current_check.split("&!")[1].split("&");
        }
        
        let complete = splitDate(aorderd.complete_date);
        let uncomplete = splitDate(aorderd.uncomplete_date);
        
        let date_data = [];
        let date_price = 0, tot_hour = 0;
        for (let i = 0; i < full_date.length;){

            let dtime = full_date[i].split("&");
            let fulltime = [];
            
            const date_time = await DataFind(`SELECT * FROM tbl_date_time WHERE id IN (${dtime[1]})`);

            for (let b = 0; b < date_time.length;){
                date_price += parseFloat(aorderd.service_price);
                tot_hour += parseFloat(1);
                let tid = (date_time[b].id).toString();

                if (current.includes(tid)) {
                    let currtime = "", currimg = "";
                    for (let c = 0; c < start.length;){
                        let startid = start[c].split('&');

                        if ([startid[0]].includes(tid) === true) {
                            currtime = [startid[0]].includes(tid) === true ? startid[1] : "";
                        }
                        c++;
                    }
                    fulltime.push({ check:'5', time: date_time[b].time, start: currtime, end: "", img: currimg });
                    
                } else if (complete.includes(tid)) {
                    let stimes = "", etime = "", currimgs = "";

                    for (let d = 0; d < start.length;){
                        let startid = start[d].split('&'), endid;

                        if (end[d] != undefined) {
                            endid = end[d].split('&');
                        } else {
                            endid = [ '0' ];
                        }
                        if ([startid[0]].includes(tid) === true) {
                            stimes = [startid[0]].includes(tid) === true ? startid[1] : "";
                        }
                        if ([endid[0]].includes(tid)) {
                            etime = endid[1];
                        }
                        d++;
                    }

                    if (stimes != "" && etime != "") {
                        fulltime.push({ check:'2', time: date_time[b].time, start: stimes, end: etime, img: currimgs });
                    } else if (stimes != "" && etime == "") {
                        fulltime.push({ check:'3', time: date_time[b].time, start: stimes, end: "", img: currimgs });
                    } else if (stimes == "" && etime != "") {
                        fulltime.push({ check:'4', time: date_time[b].time, start: "", end: etime, img: currimgs });
                    } else {
                        fulltime.push({ check:'4', time: date_time[b].time, start: "", end: "", img: currimgs });
                    }
                } else if (uncomplete.includes(tid)) {
                    fulltime.push({ check:'1', time: date_time[b].time, start: "", end: "", img: "" });
                } else {
                    fulltime.push({ check:'0', time: date_time[b].time, start: "", end: "", img: "" });
                }
                b++;
            }
            let fulldate = {
                date : dtime[0], 
                times : fulltime
            };
            date_data.push(fulldate);

            i++;
        }

        delete aorderd.date_time;
        delete aorderd.pet;
        delete aorderd.address;

        delete aorderd.payment_type;
        delete aorderd.wallet_amount;
        delete aorderd.wallet_type;

        aorderd.online_payment = online_payment;
        aorderd.online_amount = online_amount;
        aorderd.wallet_payment = wallet_payment;
        aorderd.wallet_amount = wallet_amount;

        let pet_charge = 0;
        for (let a = 0; a < pet_data.length;){

            if (a >= 1) {
                pet_charge += parseFloat(aorderd.ex_pet_charge);
            }
            a++;
        }

        res.render("order_detail", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, order_detail:aorderd, Address_data:Address_data[0], 
            pet_data, date_data, date_price, tot_hour
        });
    } catch (error) {
        console.log(error);
    }
});



module.exports = router;
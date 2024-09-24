/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const bcrypt = require('bcrypt');
const multer  = require('multer');
let mysql = require('mysql');
const geolib = require('geolib');
const axios = require('axios');
const sendOneNotification = require("../middleware/send");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");

const storage1 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/pet image");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const pet_image = multer({storage : storage1});

const storage2 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/story");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const story_img = multer({storage : storage2});

// ============= Customer ================ //

router.post('/add_customer', async (req, res) => {
    try {
        const {Name, Email, ccode, phone, Password, rcode} = req.body;

        const missingField = ["Name", "Email", "ccode", "phone", "Password"].find(field => !req.body[field]);
        if (missingField) {
            return res.status(200).json({ message: 'Enter All Details', status:false});
        }

        const login_phone = await DataFind(`SELECT * FROM tbl_admin WHERE country_code = '${ccode}' AND phone = '${phone}'`);
        if (login_phone != "") {
            return res.status(200).json({ message: 'PhoneNo Already Exist', status:false });
        }

        const hash = await bcrypt.hash(Password, 10);

        let referral = '';
        let characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let charactersLength = characters.length;
        for (let i = 0; i < 6; i++) {
            referral += characters.charAt(Math.floor(Math.random() * charactersLength));
        }

        const admin_id = await DataInsert(`tbl_admin`, `name, email, country_code, phone, password, role`, `'${Name}', '${Email}', '${ccode}', '${phone}', '${hash}', '2'`, req.hostname, req.protocol);
        if (admin_id == -1) {
        
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }
        
        if (await DataInsert(`tbl_customer`, `name, email, country_code, phone, referral_code, favorite_sitter, tot_balance, status`,
            `'${Name}', '${Email}', '${ccode}', '${phone}', '${referral}', '', '0', '1'`, req.hostname, req.protocol) == -1) {
        
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        const customer_data = await DataFind(`SELECT name, email, country_code, phone, referral_code, favorite_sitter, tot_balance FROM tbl_customer WHERE country_code = '${ccode}' AND phone = '${phone}'`);

        const general_setting = await DataFind(`SELECT refer_credit FROM tbl_general_settings`);

        if (rcode != "") {
            const referal_customer = await DataFind(`SELECT * FROM tbl_customer WHERE referral_code = '${rcode}'`);
            if (referal_customer != "") {
                let amount = parseFloat(referal_customer[0].tot_balance) + parseFloat(general_setting[0].refer_credit);

                if (await DataUpdate(`tbl_customer`, `tot_balance = '${amount}'`, `id = '${referal_customer[0].id}'`, req.hostname, req.protocol) == -1) {
                
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                }
            }   
        }

        res.status(200).json({ message: 'Upload successful', status:true, user_data:{...{id:admin_id.insertId}, ...customer_data[0]} });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function otpSend(ccode, phone, general_setting, hostname, protocol) {
    
    let otpstatus = 0;
    let otp_result = '';
    let char = '0123456789';
    let charlen = char.length;
    for (let i = 0; i < 6; i++) {
        otp_result += char.charAt(Math.floor(Math.random() * charlen));
    }
    
    if (general_setting[0].sms_type == "1") {
        let auth_key = general_setting[0].msg_key;
        let template_id = general_setting[0].msg_token;
        
        let pho_no = ccode + phone;
        const options = {
            method: 'POST',
            url: 'https://control.msg91.com/api/v5/otp?template_id='+ template_id +'&mobile='+ pho_no +'&otp=' + otp_result,
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                authkey: auth_key
            },
            data: {Param1: 'value1'}
        };
    
        axios.request(options)
        .then(function (response) {
            console.log(response.data);
        })
        .catch(function (error) {
            console.error(error);
        });
    } 
    
    if (general_setting[0].sms_type == "2") {
        let accountSid = general_setting[0].twilio_sid;
        let authToken = general_setting[0].twilio_token;
    
        const client = require('twilio')(accountSid, authToken);
    
        client.messages.create({
            body: 'Your '+ general_setting[0].title +' otp is '+ otp_result +'',
            from: general_setting[0].twilio_phoneno,
            to: ccode + phone
        })
        .then(message => {
            console.log(message.sid);
        })
        .catch((error) => {
            console.log(error);
        });
    }
    
    if (general_setting[0].sms_type != "3") {
        otpstatus = 1;
        const checkotpd = await DataFind(`SELECT * FROM tbl_cusotp_check WHERE country_code = '${ccode}' AND phone = '${phone}'`);
    
        if(checkotpd != "") {
            if (await DataUpdate(`tbl_cusotp_check`, `otp = '${otp_result}'`, `country_code = '${ccode}' AND phone = '${phone}'`, hostname, protocol) == -1) {
                return -1;
            }
        } else {
            if (await DataInsert(`tbl_cusotp_check`, `country_code, phone, otp`, `'${ccode}', '${phone}', '${otp_result}'`, hostname, protocol) == -1) {
                return -1;
            }
        }
    }
    return otpstatus;
}

router.post('/check_customer', async (req, res) => {
    try {
        const {ccode, phone, signup, forgot} = req.body;

        if (ccode == "" || phone == "") return res.status(200).json({ message: 'Number Not Found!', status:false });

        const login_phone = await DataFind(`SELECT * FROM tbl_admin WHERE country_code = '${ccode}' AND phone = '${phone}'`);
        const general_setting = await DataFind(`SELECT title, sms_type, msg_key, msg_token, twilio_sid, twilio_token, twilio_phoneno FROM tbl_general_settings`);

        let email_check = true, phone_check = true, otpstatus = 0;
        let email_message = "Email Not Exist", phone_message = "PhoneNo Not Exist";

        if (login_phone != "") {
            phone_check = false;
            phone_message = "PhoneNo Already Exist";
        }
        
        if (forgot == "1" && login_phone != "") {
            if (await otpSend(ccode, phone, general_setting, req.hostname, req.protocol) == -1) {
                res.status(200).json({ message: process.env.dataerror, status:false });
            }
        }

        if (signup == "1" && login_phone == "") {
            if (await otpSend(ccode, phone, general_setting, req.hostname, req.protocol) == -1) {
                res.status(200).json({ message: process.env.dataerror, status:false });
            }
        }

        if (general_setting[0].sms_type != "3") {
            otpstatus = 1;
        }
        
        return res.status(200).json({ otpstatus, email_check, phone_check, email_message, phone_message });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/signupotp", async(req, res)=>{
    try {
        const {ccode, phone, otp} = req.body;

        if (ccode == "" || phone == "" || otp == "") return res.status(200).json({ message: 'Detail Not Found!', status:false });

        const check = await DataFind(`SELECT * FROM tbl_cusotp_check WHERE country_code = '${ccode}' AND phone = '${phone}'`);

        if (check == "") return res.status(200).json({ message: 'PhoneNo Not Exist', status:false });

        if (check[0].otp == otp) {

            if (await DataDelete(`tbl_cusotp_check`, `country_code = '${ccode}' AND phone = '${phone}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
            return res.status(200).json({ message: 'Entered OTP is Correct', status:true });
        }
        else return res.status(200).json({ message: 'Entered OTP is Not Match', status:false });
    } catch (error) {
        console.log(error);
    }
});



router.post('/edit_profile', async (req, res) => {
    try {
        const {id, Name, Email, ccode, phone, Password} = req.body;

        const missingField = ["id", "Name", "Email", "ccode", "phone"].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ message: 'Enter All Details', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${id}'`);
        if (admin_data == "") {
            return res.status(200).json({ message: 'Detail Not Available', status:false});
        }
        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE country_code = '${admin_data[0].country_code}' AND phone = '${admin_data[0].phone}'`);

        if (customer == "") {
            return res.status(200).json({ message: 'Detail Not Available', status:false});
        } else {

            if (Password == "") {

                if (await DataUpdate(`tbl_admin`, `name = '${Name}', email = '${Email}', country_code = '${ccode}', phone = '${phone}'`, `id = '${admin_data[0].id}'`, req.hostname, req.protocol) == -1) {
        
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                }
            } else {
    
                const hash = await bcrypt.hash(Password, 10);

                if (await DataUpdate(`tbl_admin`, `name = '${Name}', email = '${Email}', country_code = '${ccode}', phone = '${phone}', password = '${hash}'`, `id = '${admin_data[0].id}'`, req.hostname, req.protocol) == -1) {
        
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                }
            }
    
            if (await DataUpdate(`tbl_customer`, `name = '${Name}', email = '${Email}', country_code = '${ccode}', phone = '${phone}'`, `id = '${customer[0].id}'`, req.hostname, req.protocol) == -1) {
        
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }

            const nadmin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${id}'`);
            const user_data = await DataFind(`SELECT name, email, country_code, phone, referral_code, status FROM tbl_customer WHERE id = '${customer[0].id}'`);
            let all_data = {...nadmin_data[0], ...user_data[0]};
            res.status(200).json({ message: 'Update successful', status:true, user_data:all_data });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/delete_customer', async (req, res) => {
    try {
        const {uid} = req.body;

        if (uid == "") return res.status(200).json({ message: 'Detail Not Found!', status:false});

        const admin_customer = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${uid}'`);
        if (admin_customer == "") {
            return res.status(200).json({ message: 'Customer Not Available', status:false});
        }

        if (await DataUpdate(`tbl_customer`, `status = '0'`, `country_code = '${admin_customer[0].country_code}' AND phone = '${admin_customer[0].phone}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }
  
        res.status(200).json({ message: 'Deleted successful', status:true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Login ================ //

router.post("/login", async(req, res)=>{
    try {
        const {ccode, phone, password} = req.body;

        if (ccode == "" || phone == "" || password == "") return res.status(200).json({ message: 'Detail Not Found!', status:false});

        const login_data = await DataFind(`SELECT * FROM tbl_admin WHERE role = '2' AND country_code = '${ccode}' AND phone = '${phone}'`);
        
        if (login_data == "") {
            res.status(200).json({ message: "PhoneNo Not Exist", result:false });  
            
        } else {
            
            const hash_pass = await bcrypt.compare(password, login_data[0].password);
            if (!hash_pass) {
                
                res.status(200).json({ message: "Password Not match", result:false });
            } else {
                console.log(111111);
                const customer_data = await DataFind(`SELECT name, email, country_code, phone, referral_code, status FROM tbl_customer WHERE country_code = '${login_data[0].country_code}' AND phone = '${login_data[0].phone}'`);

                console.log(customer_data);
                if (customer_data[0].status == "1") {
                    
                    let user_data = {...login_data[0], ...customer_data[0]};

                    return res.status(200).json({ message: "Login Sccessful", result:true, user_data });
                } else {   
                    return res.status(200).json({ message: "Account Deactivated", result:false });
                }
            }
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Forget Password ================ //

router.post("/forget_pass", async(req, res)=>{
    try {
        const {ccode, phone, password} = req.body;

        if (ccode == "" || phone == "" || password == "") return res.status(200).json({ message: 'Detail Not Found!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE country_code = '${ccode}' AND phone = '${phone}'`);

        if (admin_data == "") {
            res.status(200).json({ message: "PhoneNo Not Exist", status:false });
        } else {
            const hash = await bcrypt.hash(password, 10);

            if (await DataUpdate(`tbl_admin`, `password = '${hash}'`, `id = '${admin_data[0].id}'`, req.hostname, req.protocol) == -1) {
        
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
            res.status(200).json({ message: 'Password Forget successful', status:true });
        }
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// ============= FAQ ================ //

router.get('/faq', async (req, res) => {
    try {
        const faq_list = await DataFind(`SELECT * FROM tbl_faq`);
  
        res.status(200).json({  status:true, faq_list:faq_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});













// ============= pet add detail ================ //

router.get("/add_pet_detail", async(req, res)=>{
    try {
        const category_data = await DataFind(`SELECT * FROM tbl_category`);
        const breed_data = await DataFind(`SELECT * FROM tbl_breed`);
        const pet_size = await DataFind(`SELECT * FROM tbl_pet_size`);
        const pet_year = await DataFind(`SELECT * FROM tbl_pet_year`);

        res.status(200).json({  status:true, category_data, breed_data,pet_size, pet_year });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// ============= customer pet detail ================ //

router.post("/add_pet", pet_image.single('image'), async(req, res)=>{
    try {
        const {customerid, name, categoryid, breed, gender, pet_size, pet_year, natured, date} = req.body;

        const missingField = ["name", "categoryid", "breed", "gender", "pet_size", "pet_year", "date", "natured"].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ message: 'Enter All Details', status:false});
        
        const imageUrl = req.file ? "uploads/pet image/" + req.file.filename : null;

        const pet_id = await DataInsert(`tbl_pet_detail`, `customer, image, name, category, breed, gender, pet_size, pet_year, pet_nature, date`,
                                    `'${customerid}', '${imageUrl}', '${name}', '${categoryid}', '${breed}', '${gender}', '${pet_size}', '${pet_year}', '${natured}', '${date}'`, req.hostname, req.protocol);
        
        if (pet_id  == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        return res.status(200).json({ message: 'Pet Add successful', status:true, insertedId:pet_id.insertId});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/pet_detail", async(req, res)=>{
    try {
        const {pet_id} = req.body;

        if (pet_id == "") return res.status(200).json({ message: 'Detail Not Found!', status:false});

        const pet_data = await DataFind(`SELECT pet.*,
                                        COALESCE(ca.image, '') as category_image, COALESCE(ca.name, '') as category_name,
                                        COALESCE(br.name, '') as breed_name,
                                        COALESCE(si.name, '') as size_name, COALESCE(si.min_size, '') as min_size, COALESCE(si.max_size, '') as max_size, COALESCE(si.units, '') as size_units,
                                        COALESCE(ye.name, '') as year_name, COALESCE(ye.min_year, '') as min_year, COALESCE(ye.max_year, '') as max_year, COALESCE(ye.units, '') as year_units
                                        FROM tbl_pet_detail pet
                                        LEFT JOIN tbl_category ca ON pet.category = ca.id
                                        LEFT JOIN tbl_breed br ON pet.breed = br.id
                                        LEFT JOIN tbl_pet_size si ON pet.pet_size = si.id
                                        LEFT JOIN tbl_pet_year ye ON pet.pet_year = ye.id
                                        WHERE pet.id = '${pet_id}'`);

        if (pet_data != "") {
            return res.status(200).json({ status:true, pet_data:pet_data[0]});                                    
        } else {   
            return res.status(200).json({ status:false, pet_data:[]});                                    
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/edit_pet", pet_image.single('image'), async(req, res)=>{
    try {
        const {pet_id, name, categoryid, breed, gender, pet_size, pet_year, natured} = req.body;

        const missingField = ["name", "categoryid", "breed", "gender", "pet_size", "pet_year", "natured"].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ message: 'Enter All Details', status:false});
        
        if (!req.file) {

            if (await DataUpdate(`tbl_pet_detail`,
                `name = '${name}', category = '${categoryid}', breed = '${breed}', gender = '${gender}', pet_size = '${pet_size}', pet_year = '${pet_year}', pet_nature = '${natured}'`,
                `id = '${pet_id}'`, req.hostname, req.protocol) == -1) {
        
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }

        } else {

            const imageUrl = req.file ? "uploads/pet image/" + req.file.filename : null;

            if (await DataUpdate(`tbl_pet_detail`,
                `image = '${imageUrl}', name = '${name}', category = '${categoryid}', breed = '${breed}', gender = '${gender}', pet_size = '${pet_size}', pet_year = '${pet_year}', 
                pet_nature = '${natured}'`,
                `id = '${pet_id}'`, req.hostname, req.protocol) == -1) {
        
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
        }

        return res.status(200).json({ status:true, message: 'Pet Update successful'});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});











// ============= Customer Address ================ //

router.post('/address', async (req, res) => {
    try {
        const {uid} = req.body;

        if (uid == "") return res.status(200).json({ message: 'Detail Not Found!', status:false});

        const address_list = await DataFind(`SELECT * FROM tbl_customer_address where customer_id = '${uid}' `);
  
        if (address_list != "") {   
            res.status(200).json({  status:true, message: 'Address load successful', address_list });
        } else {
            res.status(200).json({  status:true, message: 'Address Not Found!', address_list });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/add_address", async(req, res)=>{
    try {
        const {customer_id, house_no, address, landmark, instruction, address_as, country_code, phone, latitude, longitude, google_address} = req.body;

        const missingField = ["customer_id", "house_no", "address", "landmark", "address_as", "country_code", "phone", "latitude", "longitude", "google_address"].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ status:false, message: 'Enter All Details'});
        
        if (await DataInsert(`tbl_customer_address`,
            `customer_id, house_no, address, landmark, address_as, country_code, phone, latitude, longitude, google_address, instruction`,
            `'${customer_id}', '${house_no}', '${address}', '${landmark}', '${address_as}', '${country_code}', '${phone}', '${latitude}', '${longitude}', '${google_address}', '${instruction}'`, req.hostname, req.protocol) == -1) {
        
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        return res.status(200).json({ status:true, message: 'Address add successful'});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Home ================ //

async function checkzone(current_loca) {
    const zone_data = await DataFind(`SELECT * FROM tbl_zone`);
    let all_zone = [];
    for (let i = 0; i < zone_data.length;){
        let aplz = zone_data[i].lat_lon.split(',');
        let all_lat = [];

        for (let a = 0; a < aplz.length; ){
            let [latitude, longitude] = aplz[a].split(':').map(Number);
            all_lat.push({ latitude, longitude });
            a++;
        }

        let count = geolib.isPointInPolygon(current_loca, all_lat);
        if (count === true) {
            all_zone.push(zone_data[i].id);
        }
    i++;
    }
    return all_zone;
}

function customRound(number) {
    if (number % 1 >= 0.25 && number % 1 < 0.75) {
        return Math.round(number * 2) / 2;
    } else {
        return Math.round(number);
    }
}

router.post("/home", async(req, res)=>{
    try {
        const {uid, lat, lon} = req.body;
        
        if ( uid == "" || lat == "" || lon == "") {
            res.status(200).json({status:false, message: 'Your Location Not find'});
            return;
        }
        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${uid}'`);
        if ( admin_data == "" ) {
            res.status(200).json({status:false, message: 'User Not find'});
            return;
        }

        const banner_data = await DataFind(`SELECT tbl_banner.*,
                                            tbl_services.name as services_name
                                            FROM tbl_banner
                                            join tbl_services on tbl_banner.services = tbl_services.id AND 1 = tbl_services.status`);

        const pet_data = await DataFind(`SELECT id, image, name FROM tbl_pet_detail where customer = '${uid}' ORDER BY id DESC`);

        const custoer_data = await DataFind(`SELECT id, favorite_sitter FROM tbl_customer WHERE country_code = '${admin_data[0].country_code}' AND phone = '${admin_data[0].phone}'`);
                                    
        let favorite_sitter_data = [], favorite_id = "";
        if (custoer_data != "") {
            favorite_id = custoer_data[0].favorite_sitter == 0 || custoer_data[0].favorite_sitter == null ? "" : custoer_data[0].favorite_sitter.split(",");
        }

        const services_data = await DataFind(`SELECT * FROM tbl_services WHERE status = 1`);

        const general_setting = await DataFind(`SELECT site_currency, one_app_id, one_api_id, google_map_key FROM tbl_general_settings`);
        let sitter_data = [], high_rate = [];

        const current_loca = { latitude: Number(lat), longitude: Number(lon) };
        let all_zone = await checkzone(current_loca);

        const as_data = await DataFind(`SELECT id, logo, cover_logo, country_code, phone, title, subtitle, address, zone, latitude, longitude FROM tbl_sitter WHERE status = '1' AND zone = '${all_zone}' ORDER BY id DESC`);

        for (let i = 0; i < as_data.length;) {   
            let slocation = { latitude: Number(as_data[i].latitude), longitude: Number(as_data[i].longitude) };

            let distance = geolib.getDistance(current_loca, slocation);
            let kmdata = (distance / 1000).toFixed(2);

            const { id, logo, cover_logo, title, subtitle, address } = as_data[i];
            sitter_data.push({ id, logo, cover_logo, title, subtitle, address, distance: kmdata });
            
            if (favorite_id != "") {
                let fav_id = (id).toString();
                if (favorite_id.includes(fav_id) === true ) {
                    favorite_sitter_data.push({ id, logo, cover_logo, title, subtitle, address });
                }
            }

            let review = await DataFind(`SELECT rev.id, rev.sitter_id, COUNT(*) as tot_review, SUM(rev.star_no) as tot_star, SUM(rev.star_no) / COUNT(*) as avg_star
                                        FROM tbl_sitter_reviews as rev
                                        JOIN tbl_admin on tbl_admin.country_code = '${as_data[i].country_code}' AND tbl_admin.phone = '${as_data[i].phone}'
                                        WHERE rev.sitter_id = tbl_admin.id
                                        GROUP BY rev.sitter_id`);
            
            if (review != "") {
                if (review[0].avg_star != "0") {
                    review[0].avg_star = customRound(review[0].avg_star);
                }
                const coupon_list = await DataFind(`SELECT sub_title FROM tbl_coupon WHERE sitter_id = '${review[0].sitter_id}' ORDER BY id DESC LIMIT 1`);
                let coupond = coupon_list != "" ? coupon_list[0].sub_title : "";
                high_rate.push({ id, cover_logo, title, subtitle, coupon:coupond, avg_star: review[0].avg_star });
            }
            i++;
        }

        let high_sort = high_rate.sort((a, b) => b.avg_star - a.avg_star);
        let high_rated_sitter = high_sort.slice(0, 5);

        delete general_setting[0].google_map_key;

        if ( general_setting == "" && banner_data == "" && sitter_data == "" && pet_data == "" && favorite_sitter_data == "" && services_data == "" && high_rated_sitter == "") {
            res.status(200).json({status:false, message: 'Data Not Found!', general_currency:general_setting[0], banner_data, sitter_data, pet_data, favorite_sitter_data, services_data:services_data, high_rated_sitter});  
        } else {
            res.status(200).json({status:true, message: 'Data load successful', general_currency:general_setting[0], banner_data, sitter_data, pet_data, favorite_sitter_data, services_data:services_data, high_rated_sitter });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Id buy Sitter ================ //

router.post("/get_sitter", async(req, res)=>{
    try {
        const {sitter_id, uid} = req.body;

        if (sitter_id == "") {
            return res.status(200).json({status:false, message: 'Data Not Found!'});
        }

        const sitter_data = await DataFind(`SELECT * FROM tbl_sitter WHERE status = '1' AND id = '${sitter_id}'`);
        
        if (sitter_data == "") {
           return res.status(200).json({status:false, message: 'Sitter Not Found!'});
        }

        const admin_cus_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${uid}'`);
        
        const custoer_data = await DataFind(`SELECT id, favorite_sitter FROM tbl_customer WHERE country_code = '${admin_cus_data[0].country_code}' AND phone = '${admin_cus_data[0].phone}'`);

        let fav_data = [ '0' ];
        if (custoer_data[0].favorite_sitter != null) {
            fav_data = custoer_data[0].favorite_sitter.split(",");
        }

        let is_favorite = {is_favorite:0};
        if (fav_data[0] != "0") {
            let fid = (sitter_data[0].id).toString();
            if (fav_data.includes(fid) === true) {
                is_favorite = {is_favorite:1};
            }
        }

        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE country_code = '${sitter_data[0].country_code}' AND phone = '${sitter_data[0].phone}'`);

        const review_data = await DataFind(`SELECT rev.date, rev.review, rev.star_no, 
                                            tbl_services.name as s_name, 
                                            tbl_admin.name as c_name
                                            FROM tbl_sitter_reviews as rev
                                            join tbl_services on rev.service_id = tbl_services.id AND 1 = tbl_services.status
                                            join tbl_admin on rev.customer_id = tbl_admin.id
                                            WHERE rev.sitter_id = '${admin_data[0].id}'`);

        let service_rating = await DataFind(`SELECT COALESCE(SUM(star_no) / COUNT(*), 0) as avg_rating FROM tbl_sitter_reviews WHERE sitter_id = ${admin_data[0].id} GROUP BY sitter_id`);

        let rating = { rating: 0 };
        if (service_rating != "") {
            let nset = customRound(service_rating[0].avg_rating);
            rating = { rating: nset };
        }
        let all_sitter_data = {...sitter_data[0], ...is_favorite, ...rating, ...{treview: review_data.length}};

        const about_data = await DataFind(`SELECT * FROM tbl_about WHERE sitter_id = '${admin_data[0].id}'`);
        
        let head_des = [];
        if (about_data == "") {
            head_des = [];
        } else {
            const aboutid = about_data[0].about_id.split("&!");
            const aboutheading = about_data[0].heading.split("&!");
            const aboutdes = about_data[0].description.split("&!");
            const abouttitle = about_data[0].title.split("&!");
            const abouticon = about_data[0].icon.split("&&!");
            const aboutsubtitle = about_data[0].sub_title.split("&&!");

            aboutheading.forEach((heading, index) => {
                let dataicon = abouticon[index].split("&!");
                let datasub = aboutsubtitle[index].split("&!");

                const about = [];
                for (let i = 0; i < dataicon.length;){
                    about.push({ id: aboutid[index], icon: dataicon[i], subtitle: datasub[i] });
                    i++;
                } 

                head_des.push({ head: heading, description: aboutdes[index], title: abouttitle[index], about: about });
            });

        }

        const photos = await DataFind(`SELECT image FROM tbl_sitter_gallery where sitter_id = '${admin_data[0].id}' ORDER BY id DESC`);

        const setting = await DataFind(`SELECT sitter_time FROM tbl_sitter_setting where sitter_id = '${admin_data[0].id}'`);
        let sitter_date_time = [], timel = [], spltime = [];
        if (setting != "") {
            if (setting[0].sitter_time != "") {
                timel = setting[0].sitter_time == null ? '0' : setting[0].sitter_time;
                sitter_date_time = await DataFind(`SELECT * FROM tbl_date_time WHERE id IN (${timel})`);
                spltime = timel.split(",");
            }
        }

        let hourly = [24, 48, 72, 96, 120, 144, 168], horall = [];
        hourly.map((tmap, i) => {
            let stime = spltime.filter(fval => {
                if (i == "0") {
                    if(tmap >= parseFloat(fval)) return fval;
                } else {
                    if(hourly[i-1] <= parseFloat(fval) && tmap >= parseFloat(fval)) return fval;
                }
            });
            horall.push(stime);
        });

        const sitter_service_id = await DataFind(`SELECT tbl_sitter_services.service_id FROM tbl_sitter_services where sitter_id = '${admin_data[0].id}' GROUP BY service_id`);
        let all_servicesdata = [], services_name = [];
        
        for (let a = 0; a < sitter_service_id.length;){
            let id_services = [], date_and_time = [];
            const sitter_service_data = await DataFind(`SELECT tbl_sitter_services.*,
                                                        tbl_services.name as service_name
                                                        FROM tbl_sitter_services
                                                        join tbl_services on tbl_sitter_services.service_id =  tbl_services.id AND 1 = tbl_services.status
                                                        where sitter_id = '${admin_data[0].id}' AND service_id = '${sitter_service_id[a].service_id}'`);

            for (let b = 0; b < sitter_service_data.length;){
                let services_all = {
                    id: sitter_service_data[b].id,
                    service_id: sitter_service_data[b].service_id,
                    service_type: sitter_service_data[b].service_type,
                    price: sitter_service_data[b].price,
                    price_type: sitter_service_data[b].price_type
                };
                id_services.push(services_all);
                b++;
            }

            const date_data = await DataFind(`SELECT * FROM tbl_sitter_book_date WHERE sitter_id = '${admin_data[0].id}' AND service_id = '${sitter_service_data[0].service_id}'`);
            
            if (date_data != "") {
                
                for (let c = 0; c < date_data.length;){

                    let spltime = date_data[c].times.split(",");
                    let dates = horall[new Date(date_data[c].date).getDay()].filter((fval) => spltime.includes(fval) === false);

                    let dstatus = 0;
                    if(dates != "") dstatus = 1;

                    date_and_time.push({ddata:{date: date_data[c].date, status:dstatus}, time:spltime});
                    c++;
                }
            }
            all_servicesdata.push({service_data:id_services, book_date:date_and_time});

            services_name.push({ id: sitter_service_data[0].service_id, service_name: sitter_service_data[0].service_name });
            a++;
        }

        const faq_data = await DataFind(`SELECT * FROM tbl_sitter_faq WHERE sitter_id = '${admin_data[0].id}'`);

        const pet_detail = await DataFind(`SELECT id, image, name FROM tbl_pet_detail where customer = '${admin_data[0].id}'`);
        
        if (sitter_data == "" && services_name == "" && all_servicesdata == "" && head_des == "" && review_data == "" && pet_detail == "" && photos == "" && faq_data == "" && sitter_date_time == "") {
            res.status(200).json({status:false, message: 'Data Not Found!', sitter_data:all_sitter_data, services_name, services:all_servicesdata, about_data:head_des, review_data, 
                                                                            pet_detail, photos, faq_data, sitter_date_time});
        } else {
            res.status(200).json({status:true, message: 'Data load successful', sitter_data:all_sitter_data, services_name, services:all_servicesdata, about_data:head_des, 
                                                                                review_data, pet_detail, photos, faq_data, sitter_date_time});
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============= Add Favorite Sitter ================ //

router.post("/addfavorits_sitter", async(req, res)=>{
    try {
        const {uid, sitter_id} = req.body;

        const missingField = ["uid", "sitter_id"].find(field => !req.body[field]);
        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${uid}'`);

        if (missingField || admin_data == "") return res.status(200).json({ message: 'User Not Found!', status: false });
        
        const custoer_data = await DataFind(`SELECT id, favorite_sitter FROM tbl_customer WHERE country_code = '${admin_data[0].country_code}' AND phone = '${admin_data[0].phone}'`);
        const sitter_data = await DataFind(`SELECT id, tot_favorite FROM tbl_sitter WHERE status = '1' AND id = '${sitter_id}'`);

        if (sitter_data == "") return res.status(200).json({ message: 'Sitter Not Found!', status: false });

        let favorite_id = custoer_data[0].favorite_sitter.split(',');

        let all_fav_id, match_id;
        if (favorite_id == null) {
            match_id = null;
        } else {
            match_id = favorite_id.includes(sitter_id);
        }

        if (match_id === false) {
            all_fav_id = favorite_id == 0 ? sitter_id : custoer_data[0].favorite_sitter + ',' + sitter_id;

            if (await DataUpdate(`tbl_customer`, `favorite_sitter = '${all_fav_id}'`, `id = '${custoer_data[0].id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }

            let id_number = sitter_data[0].tot_favorite;
            let count = parseFloat(id_number) + parseFloat(1);

            if (await DataUpdate(`tbl_sitter`, `tot_favorite = '${count}'`, `id = '${sitter_id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }

            return res.status(200).json({ message: 'Add successful', status:true });
        } else {

            let spl_favorite_id = favorite_id.filter(item => item != sitter_id);
            
            let added_id = spl_favorite_id.join(",");

            all_fav_id = added_id == "" ? 0 : added_id;

            let id_number = sitter_data[0].tot_favorite;
            let count = parseFloat(id_number) - parseFloat(1);

            if (await DataUpdate(`tbl_sitter`, `tot_favorite = '${count}'`, `id = '${sitter_id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            } else {
                await DataUpdate(`tbl_customer`, `favorite_sitter = '${all_fav_id}'`, `id = '${custoer_data[0].id}'`, req.hostname, req.protocol);
            }

            return res.status(200).json({ message: 'Remove successful', status:true });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});






// ============= Service Sitter ================ //

router.post("/service_sitter", async(req, res)=>{
    try {
        const {service_id, lat, lon} = req.body;

        if (service_id == "" || lat == "" || lon == "") return res.status(200).json({ message: 'Detail Not Found!', status:false});

        const current_loca = { latitude: Number(lat), longitude: Number(lon) };
        let all_zone = await checkzone(current_loca);

        const sitterl = await DataFind(`SELECT ss.id, ss.sitter_id, ss.service_id, ss.service_type, ss.price, ss.price_type,
                                        sit.id, sit.name, sit.logo, sit.title, sit.description, sit.latitude, sit.longitude, sit.tot_favorite, sit.verified_status
                                        FROM tbl_sitter_services as ss
                                        JOIN tbl_admin AS adm ON ss.sitter_id = adm.id
                                        JOIN tbl_sitter AS sit ON adm.country_code = sit.country_code AND adm.phone = sit.phone AND sit.status = 1 AND zone IN (${all_zone})
                                        WHERE ss.service_id = '${service_id}' GROUP BY sitter_id `);

        let sitter_data = [];
        if (sitterl == "") {
            return res.status(200).json({status:false, message: 'Service Not Found!', sitter_data});
        }
        
        for (let i = 0; i < sitterl.length;){
           
            let slocation = { latitude: Number(sitterl[i].latitude), longitude: Number(sitterl[i].longitude) };
    
            let distance = geolib.getDistance(current_loca, slocation);
            let sitter_distance = { sitter_distance: (distance / 1000).toFixed(2) };
            let srvives_data = {service_type:sitterl[i].service_type, price:sitterl[i].price, price_type:sitterl[i].price_type};
    
            const review_data = await DataFind(`SELECT COUNT(*) as tot_review FROM tbl_sitter_reviews WHERE sitter_id = '${sitterl[i].id}'`);
    
            let review = await DataFind(`SELECT COALESCE(SUM(rev.star_no) / COUNT(*), 0) as avg_star
                                        FROM tbl_sitter_reviews as rev
                                        WHERE rev.sitter_id = ${sitterl[i].id}
                                        GROUP BY rev.sitter_id`);

            if (review != "") {
                if (review[0].avg_star != "0") {
                    review[0].avg_star =  customRound(review[0].avg_star);
                }
            } else {
                review = [{ avg_star : 0 }];
            }

            delete sitterl[i].sitter_id;
            delete sitterl[i].service_id;
            
            sitter_data.push({...sitterl[i], ...srvives_data, ...sitter_distance, ...review_data[0], ...review[0]});
            
        i++;
        }                            

        if (sitter_data == "") {
            res.status(200).json({status:false, message: 'Data Not Found!', sitter_data});
        } else {
            res.status(200).json({status:true, message: 'Data load successful', sitter_data });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});






function formatDate(date) {
    const day = date.getDate() < 10 ? '0' + date.getDate() : date.getDate();
    const month = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1);
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
}

// ============= Card Data ================ //

router.post("/user_cart_data", async(req, res)=>{
    try {
        const {uid, sitter_id} = req.body;
        if (uid == "" || sitter_id == "") return res.status(200).json({ message: 'Data Not Found!', status:false});

        const cus_admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${uid}'`);
        const sitter_data = await DataFind(`SELECT * FROM tbl_sitter WHERE status = '1' AND id = '${sitter_id}'`);
				if (cus_admin_data == "") {
            return res.status(200).json({status:false, message: 'Customer Not Found!', sitter_data});
        }
        const wallet = await DataFind(`SELECT tot_balance FROM tbl_customer where country_code = '${cus_admin_data[0].country_code}' AND phone = '${cus_admin_data[0].phone}'`);

        const pet_data = await DataFind(`SELECT id, image, name FROM tbl_pet_detail where customer = '${uid}' ORDER BY id DESC`);
        let address_list = await DataFind(`SELECT * FROM tbl_customer_address where customer_id = '${uid}' `);

        const commission_data = await DataFind(`SELECT commission_rate, commisiion_type FROM tbl_general_settings`);
        
        let wallet_amount = 0;
        if (wallet[0].tot_balance !== null) {
            wallet_amount = wallet[0].tot_balance;
        }

        let charge, pet_charge, coupon_list;
        if (sitter_data != "") {
            
            const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE country_code = '${sitter_data[0].country_code}' AND phone = '${sitter_data[0].phone}'`);
    
            pet_charge = await DataFind(`SELECT extra_pet_charge FROM tbl_sitter_setting WHERE sitter_id = '${admin_data[0].id}'`);
            charge = pet_charge == "" ? "0" : pet_charge[0].extra_pet_charge;
    
            const coupon = await DataFind(`SELECT * FROM tbl_coupon WHERE sitter_id = '${admin_data[0].id}'`);
    
            coupon_list = [];
            let today = formatDate(new Date());
            for (let i = 0; i < coupon.length;){
                
                let start_date = formatDate(new Date(coupon[i].start_date));
                let end_date = formatDate(new Date(coupon[i].end_date));
                
                let start_check = today >= start_date;
                let end_check = today <= end_date;
    
                if (start_check === true && end_check === true) {
                    coupon_list.push({ id:coupon[i].id, title:coupon[i].title, sub_title:coupon[i].sub_title, code:coupon[i].code, start_date:start_date, end_date:end_date, 
                                        min_amount:coupon[i].min_amount, discount_amount:coupon[i].discount_amount });
                }
                i++;
            }
        }

        if (wallet == "" && commission_data == "" && pet_charge == "" && address_list == "" && pet_data == "" && coupon_list == "") {
            res.status(200).json({status:false, message: 'Data Not Found!', wallet_amount:wallet, commission_data:commission_data[0], pet_additional_charge:pet_charge[0], pet_data, address_list, coupon_list });
        } else {
            res.status(200).json({status:true, message: 'Data load successful', wallet_amount, commission_data:commission_data[0], pet_additional_charge:{extra_pet_charge:charge}, pet_data, address_list, coupon_list });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



function getfulldate() {
    let date = new Date();
    let day = (date.getDate() < 10 ? '0'+date.getDate() : date.getDate());
    let month = (date.getMonth()+1 < 10 ? '0'+(date.getMonth()+1) : date.getMonth()+1);
    let year = date.getFullYear();
    let hours = (date.getHours() % 12 || 12);
    let minutes = (date.getMinutes() < 10 ? '0'+date.getMinutes() : date.getMinutes());
    let ampm = (date.getHours() >= 12) ? 'PM' : 'AM';
    return `${year}-${month}-${day} | ${hours}:${minutes} ${ampm}`;
}

// ============= Add Card ================ //

router.post("/add_order", async(req, res)=>{
    try {
        const { uid, sitter_id, service_id, subservice_id, pet_id, date_time, message, coupon, coupon_amount, address, tot_price, additional_price, sitter_commission, site_commisiion, payment_type,
                wallet_amount, front_code, front_note } = req.body;

        const missingField = ["uid", "sitter_id", "service_id", "subservice_id", "pet_id", "date_time", "address", "tot_price", "sitter_commission", "site_commisiion", "payment_type", "wallet_amount"].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ message: 'Enter All Details', status:false});

        const sitter_data = await DataFind(`SELECT * FROM tbl_sitter WHERE status = '1' AND id = '${sitter_id}'`);
        if (sitter_data == "") return res.status(200).json({ message: 'User Not Found!', status: false });

        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE country_code = '${sitter_data[0].country_code}' AND phone = '${sitter_data[0].phone}'`);

        let today_date = new Date();
        let day = (today_date.getDate() < 10 ? '0'+today_date.getDate() : today_date.getDate());
        let month = (today_date.getMonth()+1 < 10 ? '0'+(today_date.getMonth()+1) : today_date.getMonth()+1);
        let year = today_date.getFullYear();
        let today = `${year}-${month}-${day}`;

        if (await DataDelete(`tbl_sitter_book_date`, `date < '${today}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        let full_date_time = "", fulltitme = "";

        const sdata = await DataFind(`SELECT ser.name, subs.service_type FROM tbl_sitter_services as subs
                                    LEFT JOIN tbl_services as ser ON ${service_id} = ser.id AND 1 = ser.status
                                    WHERE subs.id = ${subservice_id}`);

        let newmessage = ""+sdata[0].name+" =>\n"+sdata[0].service_type+"\n\n";

        for (let i = 0; i < date_time.length;){
            newmessage += date_time[i].date + "\n";

            let full_date = "", time_id = [];
            for (let d = 0; d < date_time[i].times.length;){
                time_id.push(Number(date_time[i].times[d]));
                d++;
            }
            time_id.sort((a, b) => a - b);
            
            let check = 0, atime = "", lastl = [time_id.length - 1][0];
            for (let t = 0; t < time_id.length;) {

                const dt = await DataFind(`SELECT * FROM tbl_date_time WHERE id = '${time_id[t]}'`);
                if (lastl == t && dt != "") {
                    newmessage += dt[0].time + "\n\n";
                } else if (dt != "") {
                    newmessage += dt[0].time + "\n";
                }

                full_date += t == 0 ? time_id[t] : ',' + time_id[t];

                if (check == "0") {
                    check = parseFloat(time_id[t]);
                    atime += date_time[i].date + '&!' + time_id[t];
                } else if (check != "0") {

                    if (check == time_id[t]) {
                        
                        atime += '&' + time_id[t];
                    } else {
                        check = parseFloat(time_id[t]);
                        atime += '&&!' + date_time[i].date + '&!' + time_id[t];
                    }
                }
                check++;
                t++;
            }

            fulltitme += fulltitme == "" ? atime : '&&!' + atime;

            full_date_time += i == 0 ? date_time[i].date + '&' + full_date : '&!' + date_time[i].date + '&' + full_date;
            
            const date_data = await DataFind(`SELECT * FROM tbl_sitter_book_date WHERE sitter_id = '${admin_data[0].id}' AND service_id = '${service_id}' AND date = '${date_time[i].date}'`);
            
            if (date_data == "") {
                
                let convert = "";
                let time_l = date_time[i].times.length;
                for (let a = 0; a < time_l;){

                    convert += a == 0 ? date_time[i].times[a] : ',' + date_time[i].times[a];
                    a++;
                }
                
                if (await DataInsert(`tbl_sitter_book_date`, `sitter_id, service_id, date, times`, `'${admin_data[0].id}', '${service_id}', '${date_time[i].date}', '${convert}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                }

            } else {

                for (let b = 0; b < date_data.length;){
                        
                    let spl_date = date_data[b].times.split(",");

                    const inputArray = spl_date.concat(date_time[i].times);
                    const sortedArray = inputArray.map(Number).sort((a, b) => a - b);
                    
                    if (await DataUpdate(`tbl_sitter_book_date`, `times = '${sortedArray}'`, `id = '${date_data[b].id}'`, req.hostname, req.protocol) == -1) {
                        return res.status(200).json({ message: process.env.dataerror, status:false });
                    }
                    
                b++;
                }
            }
            i++;
        }

        const cus_admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${uid}'`);
        const cus_wallet = await DataFind(`SELECT id, tot_balance FROM tbl_customer where country_code = '${cus_admin_data[0].country_code}' AND phone = '${cus_admin_data[0].phone}'`);
        
        if (cus_wallet != "" && wallet_amount != "0") {

            let wamount = cus_wallet[0].tot_balance == null || 0 ? 0 : cus_wallet[0].tot_balance;
            let wbalance = parseFloat(wamount) - parseFloat(wallet_amount);

            if (await DataUpdate(`tbl_customer`, `tot_balance = '${wbalance}'`, `id = '${cus_wallet[0].id}'`, req.hostname, req.protocol) == -1) {
        
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
        }

        let addi_charge = additional_price == "" ? 0 : additional_price;
        
        const tot_order = await DataFind(`SELECT COUNT(*) as total_order FROM tbl_order`);
        let order_id = tot_order[0].total_order == "0" ? 1 : parseFloat(tot_order[0].total_order) + parseFloat(1);
        
        let price = parseFloat(tot_price) + parseFloat(wallet_amount);

        let wallet_type = 0;
        if (parseFloat(wallet_amount) >= parseFloat(1)) {
            wallet_type = 1;
            if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                `'${uid}', '${wallet_amount}', '${today}', '0', '0', '${order_id}'`, req.hostname, req.protocol) == -1) {
        
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
        }
        
        const Status = await DataFind(`SELECT * FROM tbl_status_list WHERE status = '1' LIMIT 1`);

        let wallet_price = parseFloat(wallet_amount).toFixed(2);

        const emessage = mysql.escape(message);
        const efcode = mysql.escape(front_code);
        const efnote = mysql.escape(front_note);

        const orderid = await DataInsert(`tbl_order`,
        `order_id, customer_id, sitter_id, service_id, subservice_id, date_time, date, pet, status, message, coupon, coupon_amount, address, tot_price, additional_price, 
        diff_amount, sitter_commission, site_commisiion, payment_type, wallet_amount, wallet_type, front_code, front_note, reject_reason, otp_data, start_time, end_time, 
        checked_date, current_check, complete_date, uncomplete_date, un_check, date_status`,

        `'${order_id}', '${uid}', '${admin_data[0].id}', '${service_id}', '${subservice_id}', '${full_date_time}', '${today}', '${pet_id}', '${Status[0].id}', ${emessage}, 
        '${coupon}', '${coupon_amount}', '${address}', '${price.toFixed(2)}', '${addi_charge}', '', '${sitter_commission}', '${site_commisiion}', '${payment_type}', '${wallet_price}', 
        '${wallet_type}', ${efcode}, ${efnote}, '', '', '', '', '${fulltitme}', '', '', '', '', ''`, req.hostname, req.protocol);

        if (orderid == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }


        // Send Chat
        const chat_check = await DataFind(`SELECT * FROM tbl_chat
                                            WHERE (sender_id = '${uid}' AND resiver_id = '${admin_data[0].id}') OR (sender_id = '${admin_data[0].id}' AND resiver_id = '${uid}') 
                                            ORDER BY id DESC LIMIT 1 `);

        let nmes = newmessage.slice(0, -1), fdate = new Date().toISOString(), mess = "";
        if (chat_check == "") {

            const sitterg = await DataFind(`SELECT defaultm FROM tbl_sitter_setting WHERE sitter_id = '${admin_data[0].id}'`);
            if (sitterg != "") {
                if(sitterg[0].defaultm != "") {
                    mess = sitterg[0].defaultm;

                    if (await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${admin_data[0].id}', '${uid}', '${fdate}', '${sitterg[0].defaultm}'`, req.hostname, req.protocol) == -1) {
                        return res.status(200).json({ message: process.env.dataerror, status:false });
                    }
                } else {
                    mess = "Hello 👋";

                    if (await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${admin_data[0].id}', '${uid}', '${fdate}', '${mess}'`, req.hostname, req.protocol) == -1) {
                        return res.status(200).json({ message: process.env.dataerror, status:false });
                    }
                }
            } else {
                mess = "Hello 👋";

                if (await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${admin_data[0].id}', '${uid}', '${fdate}', '${mess}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                }
            }

            if (mess != "") sendOneNotification(mess, 'customer', uid);

            let sdate = new Date().toISOString();

            if ( await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${admin_data[0].id}', '${uid}', '${sdate}', '${nmes}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }

        } else {

            if (await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${admin_data[0].id}', '${uid}', '${fdate}', '${nmes}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
        }
        sendOneNotification(nmes, 'customer', uid);

        const chat_data = await DataFind(`SELECT * FROM tbl_chat_new 
                                            WHERE (sender = '${uid}' AND receiver = '${admin_data[0].id}') OR (sender = '${admin_data[0].id}' AND receiver = '${uid}') `);

        if (chat_data == "") {

            if (await DataInsert(`tbl_chat_new`, `sender, receiver, scheck, c_check`, `'${admin_data[0].id}', '${uid}', '0', '1'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
        }



        // Notification   
        
        if (await DataInsert(`tbl_notification`, `order_id, c_id, s_id, date, status`, `'${orderid.insertId}', '${uid}', '${admin_data[0].id}', '${getfulldate()}', '${Status[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        // OneSignal
        const admin = await DataFind(`SELECT * FROM tbl_admin WHERE role = '1'`);
        sendOneNotification(Status[0].notifi_text, 'admin', admin[0].id);
        sendOneNotification(Status[0].notifi_text, 'customer', uid);
        sendOneNotification(Status[0].notifi_text, 'sitter', admin_data[0].id);

        return res.status(200).json({ message: 'Order Placed successful', status:true, orderid:orderid.insertId});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============= Order Details ================ //

router.post("/order_data", async(req, res)=>{
    try {
        const {uid} = req.body;

        if (uid == "") return res.status(200).json({ message: 'Detail Not Found!', status:false});

        const Status = await DataFind(`SELECT * FROM tbl_status_list`);

        const pending_order = await DataFind(`SELECT ord.order_id, ord.date, ord.tot_price, ord.status, ord.reject_reason,
                                                sitt.name AS sitter_name, sitt.logo as sitter_logo,
                                                ser.service_type AS sub_sname, ser.price_type AS price_type,
                                                servi.name as service_name
                                                FROM tbl_order AS ord
                                                JOIN tbl_admin AS sadmin ON ord.sitter_id = sadmin.id
                                                JOIN tbl_sitter AS sitt ON sadmin.country_code = sitt.country_code AND sadmin.phone = sitt.phone
                                                JOIN tbl_sitter_services AS ser ON ord.subservice_id = ser.id
                                                JOIN tbl_services AS servi ON ord.service_id = servi.id
                                                WHERE ord.customer_id = '${uid}' AND ord.status IN ('${Status[0].id}', '${Status[1].id}', '${Status[3].id}', '${Status[4].id}') 
                                                ORDER BY ord.id DESC`);

        const past_order = await DataFind(`SELECT ord.order_id, ord.date, ord.tot_price, ord.status, ord.reject_reason,
                                                sitt.name AS sitter_name, sitt.logo as sitter_logo,
                                                ser.service_type AS sub_sname, ser.price_type AS price_type,
                                                servi.name as service_name
                                                FROM tbl_order AS ord
                                                JOIN tbl_admin AS sadmin ON ord.sitter_id = sadmin.id
                                                JOIN tbl_sitter AS sitt ON sadmin.country_code = sitt.country_code AND sadmin.phone = sitt.phone
                                                JOIN tbl_sitter_services AS ser ON ord.subservice_id = ser.id
                                                JOIN tbl_services AS servi ON ord.service_id = servi.id
                                                WHERE ord.customer_id = '${uid}' AND ord.status NOT IN ('${Status[0].id}', '${Status[1].id}', '${Status[3].id}', '${Status[4].id}') 
                                                ORDER BY ord.id DESC`);

        if (pending_order == "" && past_order == "") {
            res.status(200).json({status:false, message: 'Order Not Found!', pending_order, past_order });
        } else {
            res.status(200).json({status:true, message: 'Data load successful', pending_order, past_order });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



function splitDate(dateString) {
    return dateString ? dateString.split(',') : '';
}

router.post("/order_detail", async(req, res)=>{
    try {
        const {order_id} = req.body;
        if (order_id == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const order_detail = await DataFind(`SELECT ord.*,
                                                sta.name as order_status,
                                                sitt.name AS sitter_name, sitt.logo as sitter_logo,
                                                ser.service_type AS sub_sname, ser.price as service_price, ser.price_type AS price_type,
                                                servi.name as service_name
                                                FROM tbl_order AS ord
                                                JOIN tbl_status_list AS sta ON ord.status = sta.id
                                                JOIN tbl_admin AS sadmin ON ord.sitter_id = sadmin.id
                                                JOIN tbl_sitter AS sitt ON sadmin.country_code = sitt.country_code AND sadmin.phone = sitt.phone
                                                JOIN tbl_sitter_services AS ser ON ord.subservice_id = ser.id
                                                JOIN tbl_services AS servi ON ord.service_id = servi.id
                                                WHERE ord.order_id = '${order_id}'`);

        if (order_detail == "") {
            return res.status(200).json({status:false, message: 'Order Not Found!'});
        }

        let online_payment = "" , online_amount = "", wallet_payment = "", wallet_amount = "", payment_detail;
        let aorderd = order_detail[0];

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
        
        let current = [];
        if (aorderd.current_check != "") {
            current = aorderd.current_check.split("&!")[1].split("&");
        }

        let complete = splitDate(aorderd.complete_date);
        let uncomplete = splitDate(aorderd.uncomplete_date);
        
        let otpdate = "0";
        if (aorderd.otp_data != "") {
            otpdate = current;
        }

        let date_data = [], otp_data = [], date_price = 0, tot_hour = 0;
        for (let i = 0; i < full_date.length;){

            let dtime = full_date[i].split("&");
            let fulltime = [];
            const date_time = await DataFind(`SELECT * FROM tbl_date_time WHERE id IN (${dtime[1]})`);
            
            for (let a = 0; a < date_time.length;){
                date_price += parseFloat(aorderd.service_price);
                tot_hour += parseFloat(1);
                let tid = (date_time[a].id).toString();
                
                if (otpdate != "0") {
                    if (otpdate.includes(tid) === true) {
                        otp_data.push({ date : dtime[0], times:date_time[a].time });
                    }
                }
                
                if (current.includes(tid)) {
                    fulltime.push({ check:'3', time: date_time[a].time });
                } else if (complete.includes(tid)) {
                    fulltime.push({ check:'2', time: date_time[a].time});
                } else if (uncomplete.includes(tid)) {
                    fulltime.push({ check:'1', time: date_time[a].time});
                } else {
                    fulltime.push({ check:'0', time: date_time[a].time});
                }
                a++;
            }
            
            let fulldate = {
                date : dtime[0],
                times : fulltime
            };
            date_data.push(fulldate);
            
            i++;
        }
        const review_data = await DataFind(`SELECT * FROM tbl_sitter_reviews WHERE order_id = '${aorderd.id}'`);
        let review = review_data == "" ? "0" : "1";

        const proof_data = await DataFind(`SELECT * FROM tbl_service_proof WHERE order_id = '${aorderd.id}' ORDER BY id DESC`);
        let all_proof = [];
        if (proof_data != "") {
            let aproof = proof_data[0].proof_data.split("&!/");
            for (let b = 0; b < aproof.length;){
                let pro_date = aproof[b].split('&/');
                let pro_title = pro_date[1].split('!/');
                let pro_image = pro_title[1].split('::/');
    
                all_proof.push({ date: pro_date[0], title: pro_title[0], image: pro_image });
                b++;
            }
        }
        
        const propertiesToDelete = [
            'id', 'customer_id', 'subservice_id', 'date_time', 'pet', 'address', 'payment_type', 'wallet_amount', 'wallet_type', 'current_check', 'complete_date', 'uncomplete_date', 
            'coupon', 'start_time', 'end_time', 'checked_date', 'date_status'
        ];
        propertiesToDelete.forEach(property => delete aorderd[property]);
        
        aorderd.online_payment = online_payment;
        aorderd.online_amount = online_amount;
        aorderd.wallet_payment = wallet_payment;
        aorderd.wallet_amount = wallet_amount;
        aorderd.rstatus = review;
        aorderd.date_price = date_price;
        aorderd.tot_hour = tot_hour;
        
        if (order_detail == "" && Address_data == "" && pet_data == "" && date_data == "" && otp_data == "" && all_proof == "") {
            res.status(200).json({status:false, message: 'Order Not Found!' });
        } else {
            res.status(200).json({status:true, message: 'Data load successful', order_detail:aorderd, Address_data:Address_data[0], pet_data, date_data, otp_data, all_proof });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/order_cancellation", async(req, res)=>{
    try {
        const {order_id, reason} = req.body;

        const missingField = ["order_id", "reason"].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ message: 'Data Not Found!', status:false});

        const unorder = await DataFind(`SELECT ord.id, ord.customer_id, ord.sitter_id, ord.date_time, ord.complete_date, ord.uncomplete_date, ord.un_check, 
                                        ser.price as sprice, 
                                        cus.id as cid, cus.tot_balance as cbalance
                                        FROM tbl_order as ord
                                        JOIN tbl_sitter_services as ser ON ord.subservice_id = ser.id
                                        JOIN tbl_admin as adm ON ord.customer_id = adm.id
                                        JOIN tbl_customer as cus ON adm.country_code = cus.country_code AND adm.phone = cus.phone
                                        WHERE ord.order_id = '${order_id}'`);

        if (unorder == "") {
            return res.status(200).json({status:false, message: 'Order Not Found!'});
        }

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
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }

            if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                `'${unorder[0].customer_id}', '${untotal}', '${formatDate()}', '0', '1', '${unorder[0].id}'`, req.hostname, req.protocol) == -1) {
        
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
        }

        const oreason = mysql.escape(reason);
        const Status = await DataFind(`SELECT * FROM tbl_status_list`);
        if (await DataUpdate(`tbl_order`, `status = '${Status[2].id}', reject_reason = ${oreason}`, `id = '${unorder[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        if (await DataUpdate(`tbl_customer`, `tot_balance = '${twallet.toFixed(2)}'`, `id = '${unorder[0].cid}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        // Notification

        if (await DataInsert(`tbl_notification`, `order_id, c_id, s_id, date, status`,
            `'${unorder[0].id}', '${unorder[0].customer_id}', '${unorder[0].sitter_id}', '${getfulldate()}', '${Status[2].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        // OneSignal
        sendOneNotification(Status[2].notifi_text, 'customer', unorder[0].customer_id);
        
        res.status(200).json({status:true, message: 'Order Cancel successful' });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/chat_order', async(req, res)=>{
    try {
        const {uid, sitter_id} = req.body;

        // let match = uid.match('_')
        if (uid == "" || sitter_id == "") return res.status(200).json({status:false, message: 'Id Not Found!' });

        // let all_id = uid.split('_')
        const order_data = await DataFind(`SELECT ord.order_id, ord.date, ord.tot_price,
                                                ser.service_type AS sub_sname, ser.price_type AS price_type,
                                                servi.name as service_name
                                                FROM tbl_order AS ord
                                                JOIN tbl_admin AS sadmin ON ord.sitter_id = sadmin.id
                                                JOIN tbl_sitter_services AS ser ON ord.subservice_id = ser.id
                                                JOIN tbl_services AS servi ON ord.service_id = servi.id
                                                WHERE ord.customer_id = '${uid}' AND ord.sitter_id = '${sitter_id}'
                                                ORDER BY ord.id DESC LIMIT 1`);

        if (order_data == "") {
            res.status(200).json({status:false, message: 'Order Not Found!', order_data });
        } else {
            res.status(200).json({status:true, message: 'Data load successful', order_data });
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/map_sitter", async(req, res)=>{
    try {
        const {latitude, longitude} = req.body;

        const missingField = ["latitude", "longitude"].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ message: 'Location Not Found!', status:false});

        const current_loca = { latitude: Number(latitude), longitude: Number(longitude) };
        let all_zone = await checkzone(current_loca);

        const sitter_detail = await DataFind(`SELECT id, logo, title, subtitle, address, zone, latitude, longitude FROM tbl_sitter WHERE status = '1' AND zone IN (${all_zone})  ORDER BY id DESC`);
        let sitter_data = [];
        
        for (let i = 0; i < sitter_detail.length;) {

            let slocation = { latitude: Number(sitter_detail[i].latitude), longitude: Number(sitter_detail[i].longitude) };
                
            let distance = geolib.getDistance(current_loca, slocation);
            let kmdata = {distance:distance / 1000};
            sitter_data.push({...sitter_detail[i], ...kmdata});

            i++;
        }

        res.status(200).json({status:true, message: 'Data load successful', sitter_data });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});







// ============= Payment Details ================ //

router.post("/payment_detail", async(req, res)=>{
    try {
        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE status = '1' AND wallet_status = '1'`);
        
        if (payment_detail != "") {
            res.status(200).json({status:true, message: 'Data load successful', payment_detail });
        } else {
            res.status(200).json({status:false, message: 'Data Not Found!', payment_detail });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Add Wallet ================ //

router.post("/add_wallet", async(req, res)=>{
    try {
        const {uid, amount, date, payment_type} = req.body;

        const missingField = ["uid", "amount", "date", "payment_type"].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ message: 'Enter All Details', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${uid}'`);

        if (admin_data == "") {
            return res.status(200).json({ message: 'User Not Found', status:false});
        }
        
        const customer_data = await DataFind(`SELECT * FROM tbl_customer WHERE country_code = '${admin_data[0].country_code}' AND phone = '${admin_data[0].phone}'`);
        if (customer_data == "") {
            return res.status(200).json({ message: 'User Not Found', status:false});
        }

        let tot_amount = parseFloat(customer_data[0].tot_balance) + parseFloat(amount);

        if (await DataUpdate(`tbl_customer`, `tot_balance = '${tot_amount}'`, `id = '${customer_data[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
            `'${admin_data[0].id}', '${amount}', '${date}', '${payment_type}', '1', '0'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        return res.status(200).json({ message: 'Amount Added successful', status:true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/wallet_data", async(req, res)=>{
    try {
        const {uid} = req.body;

        if (uid == "") return res.status(200).json({ message: 'Detail Not Found!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${uid}'`);
        if (admin_data == "") {
            return res.status(200).json({ message: 'User Not Found', status:false});
        }
        
        const tot_wallet = await DataFind(`SELECT * FROM tbl_customer WHERE country_code = '${admin_data[0].country_code}' AND phone = '${admin_data[0].phone}'`);

        const wallet = await DataFind(`SELECT * FROM tbl_customer_wallet WHERE customer_id = '${admin_data[0].id}' ORDER BY id DESC`);

        let wallet_data = [];
        for (let i = 0; i < wallet.length;){

            if (wallet[i].status == "1") {

                const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '${wallet[i].payment_type}'`);
                if (payment_detail != "") {
                    wallet[i].payment_type = payment_detail[0].name;
                } else {
                    wallet[i].payment_type = `${wallet[0].amount_type} Refund`;
                }
                delete wallet[i].amount_type;
                wallet_data.push(wallet[i]);
            } else {
                wallet[i].payment_type = wallet[i].amount_type;
                delete wallet[i].amount_type;
                wallet_data.push(wallet[i]);
            }
            i++;
        }

        if (wallet_data == "" && tot_wallet == "") {
            res.status(200).json({ message: 'Data Not Found!', status:false, total_amount:tot_wallet[0].tot_balance, wallet_data });
        } else {
            res.status(200).json({ message: 'Data load successful', status:true, total_amount:tot_wallet[0].tot_balance, wallet_data });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' }); 
    }
});



// ============= Add Reviews ================ //

router.post("/add_reviews", async(req, res)=>{
    try {
        const {order_id, sitter_id, customer_id, service_id, date, review, star_no} = req.body;

        const missingField = ["order_id", "sitter_id", "customer_id", "service_id", "date", "review", "star_no"].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ message: 'Enter All Details', status:false});

        const order = await DataFind(`SELECT ord.id, ord.sitter_id, ord.pet, COALESCE(adc.name, "") as cname, COALESCE(ads.name, "") as sname
                                            FROM tbl_order AS ord
                                            LEFT JOIN tbl_admin AS adc ON ord.customer_id = adc.id
                                            LEFT JOIN tbl_admin AS ads ON ord.sitter_id = ads.id
                                            where ord.order_id = '${order_id}'`);
        
        if (await DataInsert(`tbl_sitter_reviews`, `order_id, sitter_id, customer_id, service_id, date, review, star_no`,
            `'${order[0].id}', '${sitter_id}', '${customer_id}', '${service_id}', '${date}', '${review}', '${star_no}'`, req.hostname, req.protocol) == -1) {
        
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        let allp = order[0].pet.split(","), pdata = "";
        if (allp != "") {
            for (let i = 0; i < allp.length; ){
                const data = await DataFind(`SELECT name FROM tbl_pet_detail where id = ${allp[i]}`);
                pdata += pdata == "" ? data[0].name : "," + data[0].name;
                i++;
            }
        }

        // OneSignal
        let ndata = `Hi ${order[0].sname}, We wanted to let you know that you've received a new review for your recent service with ${pdata}! You can view the feedback from ${order[0].pname} by logging into your account and navigating to the "Reviews" section. Thank you for your dedication and excellent care. Keep up the great work! Best regards,`;
       
        sendOneNotification(ndata, 'sitter', order[0].sitter_id);
        
        return res.status(200).json({ status:true, message: 'Review add successful'});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============= Add Reviews ================ //

router.post("/refer_data", async(req, res)=>{
    try {
        const {uid} = req.body;

        if (uid == "") return res.status(200).json({ message: 'Detail Not Found!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${uid}'`);
        if (admin_data == "") {
            return res.status(200).json({ message: 'User Not Found', status:false});
        }
        
        const refer_data = await DataFind(`SELECT referral_code FROM tbl_customer WHERE country_code = '${admin_data[0].country_code}' AND phone = '${admin_data[0].phone}'`);
        const general_setting = await DataFind(`SELECT signup_credit, refer_credit FROM tbl_general_settings`);

        if (general_setting == "" && refer_data == "") {
            res.status(200).json({ message: 'Data Not Found!', status:false, credit:general_setting[0], refer_data:refer_data[0] });
        } else {
            res.status(200).json({ message: 'Data load successful', status:true, credit:general_setting[0], refer_data:refer_data[0] });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Add Reviews ================ //

router.post("/pages", async(req, res)=>{
    try {
        const pages_data = await DataFind(`SELECT * FROM tbl_pages where status = '1'`);
        
        if (pages_data != "") {
            res.status(200).json({ message: 'Data load successful', status:true, pages_data });
        } else {
            res.status(200).json({ message: 'Data Not Found!', status:false, pages_data });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Add Story ================ //

const { addStory, storyData } = require("./story");

router.post("/add_story", story_img.single('image'), async(req, res)=>{
    try {
        const {uid, sitter_id} = req.body;

        if (uid == "") return res.status(200).json({ message: 'Detail Not Found!', status:false});

        const imageUrl = req.file ? "uploads/story/" + req.file.filename : null;
        
        if (await addStory(uid, sitter_id, imageUrl, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        res.status(200).json({ message: 'Story Upload successful', status:true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/story_data", async(req, res)=>{
    try {
        const {uid, lat, lon} = req.body;

        if (lat == "" || lon == "") {
            return res.status(200).json({ message: 'Location Not Found!', status:false});
        }

        let allc_story = await storyData(uid, lat, lon);

        if (allc_story != "") {
            res.status(200).json({ message: 'Story load successful', status: true, all_story: allc_story });
        } else {
            res.status(200).json({ message: 'Story Not Found!', status: false, all_story: allc_story });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Notification ================ //

router.post("/notification", async(req, res)=>{
    try {
        const {uid} = req.body;

        if (uid == "") return res.status(200).json({ message: 'Detail Not Found!', status:false});

        const notification = await DataFind(`SELECT noti.order_id, noti.date,
                                            sta.name as sname, sta.notifi_text as notification
                                            FROM tbl_notification as noti
                                            JOIN tbl_status_list as sta ON noti.status = sta.id
                                            WHERE c_id = '${uid}' ORDER BY noti.id DESC`);

        if (notification != "") {
            res.status(200).json({ message: 'Notification load successful', status: true, notification });
        } else {
            res.status(200).json({ message: 'Notification Not Found!', status: false, notification });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Search Sitter ================ //

router.post("/search", async(req, res)=>{
    try {
        const {data, lat, lon} = req.body;

        if (lat == "" || lon == "") {
            return res.status(200).json({ message: 'Location Not Found!', status:false});
        }

        const current_loca = { latitude: Number(lat), longitude: Number(lon) };      
        let all_zone = await checkzone(current_loca);

        let sitter_data = [];
        if (data == "") {
            sitter_data = await DataFind(`SELECT sit.id, sit.name, sit.logo, sit.title, sit.subtitle, sit.tot_favorite,
                                            IFNULL(SUM(sr.star_no) / COUNT(*), 0) as avg_star
                                            FROM tbl_sitter as sit
                                            JOIN tbl_admin AS ad ON sit.country_code = ad.country_code AND sit.phone = ad.phone
                                            LEFT JOIN tbl_sitter_reviews as sr ON ad.id = sr.sitter_id
                                            WHERE zone IN (${all_zone})
                                            GROUP BY sit.id`);

        } else {
            sitter_data = await DataFind(`SELECT sit.id, sit.name, sit.logo, sit.title, sit.subtitle, sit.tot_favorite,
                                            IFNULL(SUM(sr.star_no) / COUNT(*), 0) as avg_star
                                            FROM tbl_sitter as sit
                                            JOIN tbl_admin AS ad ON sit.country_code = ad.country_code AND sit.phone = ad.phone
                                            LEFT JOIN tbl_sitter_reviews as sr ON ad.id = sr.sitter_id
                                            WHERE title LIKE '%${data}%' AND zone IN (${all_zone})
                                            GROUP BY sit.id`);
        }

        sitter_data.map(sdata => {
            if (sdata.avg_star != "0") {
                let nset = customRound(sdata.avg_star);
                sdata.avg_star = nset;
            }
        });

        if (sitter_data != "") {
            res.status(200).json({ message: 'Serach load successful', status: true, sitter_data });
        } else {
            res.status(200).json({ message: 'Serach Not Found!', status: false, sitter_data });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============= Search Sitter ================ //

router.post("/send_notification", async(req, res)=>{
    try {
        const {order_id} = req.body;

        if (order_id == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const order_data = await DataFind(`SELECT ord.sitter_id, ord.pet, COALESCE(adm.name, "") as sname
                                            FROM tbl_order AS ord
                                            LEFT JOIN tbl_admin AS adm ON ord.sitter_id = adm.id
                                            where ord.order_id = '${order_id}'`);

        let allp = order_data[0].pet.split(","), pdata = "";
        if (allp != "") {
            for (let i = 0; i < allp.length; ){
                const data = await DataFind(`SELECT name FROM tbl_pet_detail where id = ${allp[i]}`);
                pdata += pdata == "" ? data[0].name : "," + data[0].name;
                i++;
            }
        }

        // OneSignal
        let ndata = `Hi ${order_data[0].sname} , I hope everything is going well! Could you please provide a quick update on how ${pdata} is doing? I'd love to know how they're settling in and if there's anything I should be aware of. Thank you for taking such good care of ${pdata}! Best,`;

        sendOneNotification(ndata, 'sitter', order_data[0].sitter_id);
        
        res.status(200).json({ message: 'Notification Send successful', status: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Paypal Payment ================ //
const paypal = require('paypal-rest-sdk');

// Create a PayPal payment
router.post('/paypal-payment', async(req, res) => {
    try {
        const { amount, uid } = req.body;
        if (amount == "" || uid == "") return res.status(200).json({ message: 'Data Not Found!', status:false});
    
        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        let pkey = payment_detail[1].attribute.split(",");
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
    
        paypal.configure({
            mode: pkey[2], // sandbox or live
            client_id: pkey[0],
            client_secret: pkey[1]
        });
      
        const paymentData = {
            intent: 'sale',
            payer: {
                payment_method: 'paypal',
                payer_info: {
                    email: admin_data[0].email,
                    first_name: admin_data[0].name
                }
            },
            redirect_urls: {
                return_url: req.hostname + "/api/paypal-success",
                cancel_url: req.hostname + "/api/paypal-success"
            },
            transactions: [{
                amount: {
                    total: amount,
                    currency: 'USD'
                },
                description: "This is the payment description."
            }]
        };
      
        paypal.payment.create(paymentData, function (error, payment) {
            if (error) {
                // console.error('Error creating payment:', error);
                return res.status(200).send({ message: 'Paypal Payment URL Not Generated!', status: false });
            } else {
                const approvalUrl = payment.links.find(link => link.rel === 'approval_url').href;
                console.log(approvalUrl);
                return res.status(200).send({ message: 'Paypal Payment URL Generate Successful', status: true, paypalURL: approvalUrl });
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
  
// Execute a PayPal payment
router.get('/paypal-success', (req, res) => {
    try {
        const { paymentId, PayerID } = req.query;
        
        const executePaymentData = {
            payer_id: PayerID
        };
        
        paypal.payment.execute(paymentId, executePaymentData, (error, payment) => {
            if (error) {
                // console.error('Error executing payment:', error);
                return res.status(200).send({ message: 'Paypal Payment Cancel', status: false });
            } else {
                // console.log('Payment executed successfully:', payment);
                return res.status(200).send({ message: 'Paypal Payment Successful', status: true });
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Strip Payment ================ //

router.post('/strip-payment', async(req, res)=>{
    try {
        const { amount, uid } = req.body;
        if (amount == "" || uid == "") return res.status(200).json({ message: 'Data Not Found!', status:false});

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        let pkey = payment_detail[2].attribute.split(",");
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const stripe = require('stripe')(pkey[1]);

        // const dynamicPrice = amount * 100; 
        const dynamicPrice = Math.round(amount * 100);

        const price = await stripe.prices.create({
            unit_amount: dynamicPrice,
            currency: 'inr',
            product_data: {
                name: admin_data[0].name,
            },
        });

        const priceId = price.id;
        stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: "payment",
        line_items: [{
            price: priceId,
            quantity: 1,
        }],
        success_url: req.hostname + "/api/strip-success?payment_intent={CHECKOUT_SESSION_ID}",
        cancel_url: req.hostname + "/api/strip-cencal?payment_intent={CHECKOUT_SESSION_ID}",

        }).then(session => {
            console.log('session data '+ session.url);
            return res.status(200).send({ message: 'Stripe Payment URL Generate Successful', status: true, StripeURL: session.url });
        }).catch(error => {
            console.error("Error creating Stripe Checkout session:", error);
            return res.status(200).send({ message: 'Stripe Payment URL Not Generated!', status: false });
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/strip-success", async(req, res)=>{
    try {
        const { payment_intent } = req.query;
        
        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail`);
        let pkey = payment_detail[2].attribute.split(",");

        const stripe = require('stripe')(pkey[1]);
        
        const session = await stripe.checkout.sessions.retrieve(payment_intent);
        const payment_intenta = session.payment_intent;

        let check = await stripe.paymentIntents.retrieve(payment_intenta);

        if (check.status == "succeeded") {   
            return res.status(200).send({ message: 'Stripe Payment Successful', status: true });
        } else {
            return res.status(200).send({ message: 'Stripe Payment Cancel!', status: false });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/strip-cencal", async(req, res)=>{
    try {
        const { payment_intent } = req.query;

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail`);
        let pkey = payment_detail[2].attribute.split(",");
        const stripe = require('stripe')(pkey[1]);
        
        const session = await stripe.checkout.sessions.retrieve(payment_intent);

        const payment_intent_id = session.payment_intent;
        
        await stripe.paymentIntents.retrieve(payment_intent_id).catch(error => {
            // console.error("Error Stripe Checkout session: ", error);
            return res.status(200).send({ message: 'Stripe Payment Cancel!', status: false });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});




// ============= Paystack Payment ================ //

router.post("/paystack-payment", async(req, res)=>{
    try {
        const {amount, uid} = req.body;
        if (amount == "" || uid == "") return res.status(200).json({ message: 'Data Not Found!', status:false});

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        let pkey = payment_detail[3].attribute.split(",");
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const paystack = require('paystack')(pkey[1]);

        const options = {
            amount: amount * 100, 
            email: admin_data[0].email,
            name: admin_data[0].name,
            phone: admin_data[0].country_code + ' ' + admin_data[0].phone,
            callback_url: req.hostname + "/api/paystack-check",
            metadata: {
                custom_fields: [
                    {
                        display_name: 'Order ID',
                        variable_name: 'order_id',
                        value: '12345'
                    }
                ]
            }
        };

        paystack.transaction.initialize(options, (error, body) => {
            if (!error) {
                const authorization_url = body.data.authorization_url;
                console.log('reference id:', body.data.reference);
                return res.status(200).send({ message: 'Paystack Payment URL Generate Successful', status: true, PaystackURL: authorization_url });
            } else {
                // console.log(error);
                return res.status(200).send({ message: 'Stripe Payment URL Not Generated!', status: false });
            }

        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/paystack-check", async(req, res)=>{
    try {
        const reference = req.query.reference;

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail`);
        let pkey = payment_detail[3].attribute.split(",");
        
        const paystackVerifyUrl = `https://api.paystack.co/transaction/verify/${reference}`;

        const headers = {
          'accept': 'application/json',
          'Authorization': `Bearer ${pkey[1]}`,
          'cache-control': 'no-cache'
        };

        axios
            .get(paystackVerifyUrl, { headers })
            .then((response) => {
            const data = response.data;
            if (data.status === true && data.data.status === 'success') {
                return res.status(200).send({ message: 'Paystack Payment Successful', status: true });

            } else {
                console.log('Transaction was Cancelled');
                return res.status(200).send({ message: 'Paystack Payment Cancel!', status: false });
                
            }
            }).catch((error) => {
                console.error('Error:', error);
                return res.status(200).send({ message: 'An error occurred!', status: false });
            });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Paystack Payment ================ //

router.post("/flutterwave-payment", async(req, res)=>{
    try {
        const {amount, uid} = req.body;
        if (amount == "" || uid == "") return res.status(200).json({ message: 'Data Not Found!', status:false});
        
        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        let pkey = payment_detail[4].attribute.split(",");
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const general_setting = await DataFind(`SELECT * FROM tbl_general_settings`);


        await axios.post("https://api.flutterwave.com/v3/payments", {
            tx_ref: Date.now(),
            amount: amount,
            currency: "NGN",
            redirect_url: req.hostname + "/api/flutterwave-check",
            customer: {
                email: admin_data[0].email,
                phonenumber: admin_data[0].country_code + ' ' + admin_data[0].phone,
                name: admin_data[0].name
            },
            customizations: {
                title: general_setting[0].title,
                logo: "https://admin.kmsteams.com/" + general_setting[0].dark_image
            }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${pkey[0]}`
            }
        }).then(session => {
            console.log(session.data.data.link);
            return res.status(200).send({ message: 'FlutterWave Payment URL Generate Successful', status: true, FlutterwaveURL: session.data.data.link });
        }).catch(error => {
            console.error("Error creating FlutterWave Checkout session:", error);
            return res.status(200).send({ message: 'FlutterWave Payment URL Not Generated!', status: false });
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.get("/flutterwave-check", async(req, res)=>{
    try {
        const tx_id = req.query.transaction_id;
        const status = req.query.status;

        if (status === 'successful') {

            const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail`);
            if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
            
            let pkey = payment_detail[4].attribute.split(",");
            if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});


            await axios.get(`https://api.flutterwave.com/v3/transactions/${tx_id}/verify`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${pkey[0]}`
                }
            }).then(response => {
                if (response.data.data.status === 'successful') {
                    console.log("Flutterwave Payment Successful!");
                    return res.status(200).send({ message: 'Flutterwave Payment Successful', status: true });
                } else {
                    console.log("Flutterwave Payment Failed!");
                    return res.status(200).send({ message: 'Flutterwave Payment Failed!', status: false });
                }
                
            }).catch(error => {
                console.log("Flutterwave Payment Failed!", error);
                return res.status(200).send({ message: 'Flutterwave Payment Failed!', status: false });
            });
        } else {
            console.log("Transaction status not successful!");
            return res.status(200).send({ message: 'Transaction not successful!', status: false });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Senangpay Payment ================ //
const crypto = require("crypto");

router.get("/senangpay-payment", async(req, res)=>{
    try {
        const {amount, uid} = req.query;
        if (amount == undefined || uid == undefined) return res.status(200).json({ message: 'Data Not Found!', status:false});

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        let pkey = payment_detail[5].attribute.split(",");
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const MERCHANT_ID = pkey[0];
        const SECRET_KEY = pkey[1];
        
        const data = `${MERCHANT_ID}${Date.now()}${amount}${SECRET_KEY}`;
        const hash = crypto.createHash('sha256').update(data).digest('hex');
        
        let am = parseFloat(amount).toFixed(2);
        // Request payload
        const detail = {
            'detail': 'Shopping_cart_id_' + Date.now()+1,
            'amount': am,
            'order_id': Date.now(),
            'order_number': Date.now(),
            'name': admin_data[0].name,
            'email': admin_data[0].email,
            'phone': admin_data[0].phone,
            'hash': hash,
            'callback_url': req.hostname + "/api/senangpay-success"
        };

        // // All Payment Detail in One Link
        // const paymentLink = `https://app.senangpay.my/payment/?${new URLSearchParams(detail).toString()}`;

        let action = "https://sandbox.senangpay.my/payment/"+ MERCHANT_ID +""; // // Sanbox
        // let action = "https://app.senangpay.my/payment/"+MERCHANT_ID+""; // // Live

        res.render("payment_form", {
            action, detail
        });
        
        // http://192.168.1.22:3000/api/senangpay-payment?amount=100&uid=70
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/senangpay-success", async(req, res)=>{
    try {
        console.log(11111);
        
        return res.status(200).send({ message: 'Senangpay Payment Successful', status: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Payfast Payment ================ //

router.get("/payfast-payment", async(req, res)=>{
    try {
        const {amount, uid} = req.query;
        if (amount == undefined || uid == undefined) return res.status(200).json({ message: 'Data Not Found!', status:false});

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        let pkey = payment_detail[6].attribute.split(",");
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        console.log(pkey);

        const detail = {
            merchant_id: pkey[1],
            merchant_key: pkey[0],
            amount: amount,
            item_name: admin_data[0].name,
            email_address: admin_data[0].email,
            return_url: req.hostname + "/api/payfast-success",
            cancel_url: req.hostname + "/api/payfast-cancel",
        };
        
        // let action = "https://www.payfast.co.za/eng/process"; // // live
        let action = "https://sandbox.payfast.co.za/eng/process"; // // sendbox

        // const paymentLink = `https://sandbox.payfast.co.za/eng/process/?${new URLSearchParams(detail).toString()}`;

        res.render("payment_form", {
            action, detail
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/payfast-success", async(req, res)=>{
    try {
        console.log("payfast successful");

        return res.status(200).send({ message: 'PayFast Payment Successful', status: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/payfast-cancel", async(req, res)=>{
    try {
        console.log("payfast cancel");
        
        return res.status(200).send({ message: 'PayFast Payment Failed!', status: false });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Midtrans Payment ================ //

const { Snap } = require('midtrans-client');

router.post("/midtrans-payment", async(req, res)=>{
    try {
        const {amount, uid} = req.body;
        if (amount == "" || uid == "") return res.status(200).json({ message: 'Data Not Found!', status:false});

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        let pkey = payment_detail[7].attribute.split(",");
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const snap = new Snap({
            isProduction: false,
            serverKey: pkey[1],
            clientKey: pkey[0]
        });

        let am = parseFloat(amount);
        if (isNaN(am)) {
            return res.status(200).json({ message: 'Invalid amount!', status:false});
        }

        const isInteger = Number.isInteger(am); // Check if the amount is already an integer
        if (!isInteger) {
            am = Math.floor(am);
        }
        
        // Create a transaction
        const transactionDetails = {
            locale: "en",
            transaction_details: {
                order_id: `ORDER-${Date.now()}`,
                gross_amount: am.toString()
            },
            customer_details: {
            first_name: admin_data[0].name,
            email: admin_data[0].email,
            phone: admin_data[0].phone
            },
            credit_card: {
                secure: true
            },
            finish_payment_return_url: req.hostname + "/api/midtrans-success",
            error_payment_return_url: req.hostname + "/api/midtrans-cancel"
        };
        
        snap.createTransaction(transactionDetails)
        .then(transactionToken => {
            return res.status(200).send({ message: 'Midtrans Payment URL Generate Successful', status: true, MidtransURL: transactionToken.redirect_url });

        }).catch(error => {

            console.error("Error creating Midtrans Checkout session:", error.data);
            return res.status(200).send({ message: 'Midtrans Payment URL Not Generated!', status: false });
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/midtrans-success", async(req, res)=>{
    try {
        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        let pkey = payment_detail[9].attribute.split(",");
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const orderId = req.query.order_id;
        console.log(orderId);
        console.log(111);

        const snap = new Snap({
            isProduction: false,
            serverKey: pkey[1],
            clientKey: pkey[0]
        });
        
        const transactionStatus = await snap.transaction.status(orderId);

        if (transactionStatus.transaction_status === 'settlement') {        
            res.status(200).json({ status: 'success' });
        } else {
            res.status(400).json({ status: 'failed', message: 'Payment was not successful' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/midtrans-cancel", async(req, res)=>{
    try {
        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        let pkey = payment_detail[9].attribute.split(",");
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const orderId = req.query.order_id;
        // const orderId = "ORDER-1715150681164";
        console.log(orderId);
        console.log(111);

        const snap = new Snap({
            isProduction: false,
            serverKey: pkey[1],
            clientKey: pkey[0]
        });
        
        const transactionStatus = await snap.transaction.status(orderId);

        if (transactionStatus.transaction_status === 'settlement') {
            res.status(200).json({ status: 'success' });
        } else {
            res.status(400).json({ status: 'failed', message: 'Payment was not successful' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});






module.exports = router;
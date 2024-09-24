/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */

const express = require("express");
const router = express.Router();
const multer  = require('multer');
const auth = require("../middleware/auth");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/category");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const upload = multer({storage : storage});

// ============= Add Category ================ //

router.get("/add", auth, async(req, res)=>{
    try {
        
        res.render("add_category", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_data", auth, upload.single('image'), async(req, res)=>{
    try {
        const {name} = req.body;
        let imageUrl = req.file ? "uploads/category/" + req.file.filename : null;

        if (await DataInsert( `tbl_category`, `image, name`, `'${imageUrl}', '${name}'`, req.hostname, req.protocol) == -1) {
            
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Category Added successfully');
        res.redirect("/category/view");
    } catch (error) {
        console.log(error);
    }
});

// ============= Category ================ //

router.get("/view", auth, async(req, res)=>{
    try {
        const category_data = await DataFind(`SELECT * FROM tbl_category`);

        res.render("category", {
            auth:req.user, category_data, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
    }
});

// ============= Edit Category ================ //

router.get("/edit/:id", auth, auth, async(req, res)=>{
    try {
        const category_data = await DataFind(`SELECT * FROM tbl_category WHERE id = '${req.params.id}'`);
        
        res.render("edit_category", {
            auth:req.user, category_data, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/edit_data/:id", auth, upload.single('image'), async(req, res)=>{
    try {
        const {name, old_img} = req.body;
        const imageUrl = req.file ? "uploads/category/" + req.file.filename : old_img;

        if (await DataUpdate(`tbl_category`, `image = '${imageUrl}', name = '${name}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Category Updated successfully');
        res.redirect("/category/view");
    } catch (error) {
        console.log(error);
    }
});

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_category`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Category Deleted successfully');
        res.redirect("/category/view");
    } catch (error) {
        console.log(error);
    }
});



// ============= Breed ================ //

router.get("/breed", auth, async(req, res)=>{
    try {
        const breed_data = await DataFind(`SELECT * FROM tbl_breed`);

        res.render("breed", {
            auth:req.user, breed_data, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_breed", auth, async(req, res)=>{
    try {
        const {name} = req.body;

        if (await DataInsert(`tbl_breed`, `name`, `'${name}'`, req.hostname, req.protocol) == -1) {

            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Breed Added successfully');
        res.redirect("/category/breed");
    } catch (error) {
        console.log(error);
    }
});

router.post("/edit_breed/:id", auth, async(req, res)=>{
    try {
        const {name} = req.body;

        if (await DataUpdate(`tbl_breed`, `name = '${name}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Breed Updated successfully');
        res.redirect("/category/breed");
    } catch (error) {
        console.log(error);
    }
});

router.get("/delete_breed/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_breed`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Breed Deleted successfully');
        res.redirect("/category/breed");
    } catch (error) {
        console.log(error);
    }
});



// ============= Breed ================ //

router.get("/pet_size", auth, async(req, res)=>{
    try {
        const pet_size = await DataFind(`SELECT * FROM tbl_pet_size`);

        res.render("pet_size", {
            auth:req.user, pet_size, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_size", auth, async(req, res)=>{
    try {
        const {name, min_size, max_size, units} = req.body;

        if (await DataInsert(`tbl_pet_size`, `name, min_size, max_size, units`, `'${name}', '${min_size}', '${max_size}', '${units}'`, req.hostname, req.protocol) == -1) {
            
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Pet Size Added successfully');
        res.redirect("/category/pet_size");
    } catch (error) {
        console.log(error);
    }
});

router.post("/edit_pet_size/:id", auth, async(req, res)=>{
    try {
        const {name, min_size, max_size, units} = req.body;

        if (await DataUpdate(`tbl_pet_size`, `name = '${name}', min_size = '${min_size}', max_size = '${max_size}', units = '${units}'`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {

            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Pet Size Updated successfully');
        res.redirect("/category/pet_size");
    } catch (error) {
        console.log(error);
    }
});

router.get("/delete_prt_size/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_pet_size`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
            
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Pet Size Deleted successfully');
        res.redirect("/category/pet_size");
    } catch (error) {
        console.log(error);
    }
});



// ============= Breed ================ //

router.get("/pet_age", auth, async(req, res)=>{
    try {
        const pet_year = await DataFind(`SELECT * FROM tbl_pet_year`);

        res.render("pet_age", {
            auth:req.user, pet_year, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_age", auth, async(req, res)=>{
    try {
        const {name, min_year, max_year, units} = req.body;

        if (await DataInsert(`tbl_pet_year`,
            `name, min_year, max_year, units`,
            `'${name}', '${min_year}', '${max_year}', '${units}'`, req.hostname, req.protocol) == -1) {

            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Pet Year Added successfully');
        res.redirect("/category/pet_age");
    } catch (error) {
        console.log(error);
    }
});

router.post("/edit_pet_year/:id", auth, async(req, res)=>{
    try {
        const {name, min_year, max_year, units} = req.body;

        if (await DataUpdate(`tbl_pet_year`, `name = '${name}', min_year = '${min_year}', max_year = '${max_year}', units = '${units}'`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {

            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        req.flash('success', 'Pet Year Updated successfully');
        res.redirect("/category/pet_age");
    } catch (error) {
        console.log(error);
    }
});

router.get("/delete_prt_age/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_pet_year`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            res.redirect("/valid_license");
        } else {
            req.flash('success', 'Pet Year Deleted successfully');
            res.redirect("/category/pet_age");
        }
    } catch (error) {
        console.log(error);
    }
});





module.exports = router;
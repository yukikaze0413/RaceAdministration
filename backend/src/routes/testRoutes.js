const express = require('express');
const routes = express.Router();

routes.get('/hello',(req,res)=>{
    res.json({message:'你好，世界！'});
});

routes.get('/time',(req,res)=>{
    const time = new Date().toLocaleString('zh-CN');
    res.json({time : time });
});

module.exports = routes;
let races =[
    {
        id: 1,name:'第一届盯帧杯',date:'2025-11-15',location:'线上'
    }
];

const AppError = require('../utils/AppError');

exports.getRaces = (req,res) =>{
    res.json({
        message:'获取赛事列表成功',
        data:races
    });
};

exports.getRaceById = (req,res,next) =>{
    try{
        const id= parseInt(req.params.id);
        const race = races.find(r => r.id === id);
        if (!race){ 
            throw new AppError('未找到该赛事',404);
        }
        res.json({
            message:'获取赛事详情成功',
            data:race
        });
    }catch (error){
        next(error);
    }
};

exports.createRace = (req,res,next) =>{
    try {
        const {name,date,location} = req.body;

        if (!name || !date || !location){
            throw new AppError('缺少必要的赛事信息',400);
        }

        if(name.length<2 || name.length>50){
            throw new AppError('赛事名称长度应在2到50个字符之间',400);
        }
        
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)){
            throw new AppError('日期格式应为YYYY-MM-DD',400);
        }

        const newRace = {
            id:races.length + 1,
            name,
            date,
            location
        };

        races.push(newRace);

        res.status(201).json({
            message:'创建赛事成功', 
            data:newRace
        });

    }catch (error){
        next(error);
    }
};

exports.deleteRace = (req,res,next) =>{
    try{
        const id = parseInt(req.params.id);
        const raceIndex =  races.findIndex(r => r.id === id);
        if (raceIndex === -1){
            throw new AppError('未找到该赛事',404);
        }
        races.splice(raceIndex,1);
        res.status(204).json({
                message:'删除赛事成功'
        });
    }catch (error){
        next(error);
    }
};

exports.updateRace = (req,res,next) =>{
    try{
        const id = parseInt(req.params.id);
        const race = races.find(r => r.id === id);
        if (!race){
            throw new AppError('未找到该赛事',404);
        }
        const {name,date,location} = req.body;
        if (name) race.name = name;
        if (date) race.date = date;
        if (location) race.location = location;
        res.status(201).json({
            message:'更新赛事成功',
            data:race
        });
    }catch (error){
       next(error);
    }
};
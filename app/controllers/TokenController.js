const jwt = require('jsonwebtoken');
const fs = require('fs');
const Token = require('../models/tokens');
const Alarma = require('../models/alarma')
const CONFIG = require('../config/config'); //va servir para crear el jwt del excell
var Excel = require('exceljs');
const mkdirp = require('mkdirp');
global.__basedir = __dirname;
const checkDirectorySync = (directory) => {
    try {
        fs.statSync(directory);
    } catch (e) {
        try {
            fs.mkdirSync(directory);
        } catch (err) {
            mkdirp.sync(directory); // error : directory & sub directories to be newly created
        }
    }
};
const delete_file = (directory) => {
    fs.unlinkSync(directory);
};

//falta validar la parte de que el token no este expirado

exports.createToken = (req, res, next) => {
    //aqui falta validar que los parametros no vengan vacios desde el post
    let token = new Token();
    token.propietario = req.decoded.user._id;
    token.nombre_token = req.body.nombre_token;
    token.nota_recordatoria = req.body.nota_recordatoria;
    token.disponible = req.body.disponible; //porque los tokens tienen un vencimiento de 7 dias o un mes, explicar al equipo, para que cuando el token venza se actualice en el servidor y ya no funcione a la hora de generar la alarma, al momento de crear una alarma validar si el token sigue siendo valido
    token.save();
    req.body.token = token;
    return next();
};
exports.createAlarma = (req, res, next) => {
    //aqui falta validar que los parametros no vengan vacios desde el post
    let alarma = new Alarma();
    //console.log(req.decoded.id_token);
    alarma.id_token = req.decoded.id_token;
    alarma.ip_address = req.body.ip_address;
    alarma.hostname = req.body.hostname;
    alarma.mac_addres = req.body.mac_addres;
    alarma.save();
    res.json({
        success: true,
        message: 'Alarma generada'
    });
};


exports.getTokens = (req, res, next) => {
    const hostname = req.headers.host;
    const baseurl = '/api_v1/tokens/download/';
    const dominio = hostname + baseurl;
    const id_user = req.decoded.user._id;
    const separador = '/';
    const tipo = '.xlsx'; //esta puede cambiar más adelante
    Token.find({ propietario: id_user })
        .populate('propietario')
        .exec()
        .then(tokens => {
            const response = {
                count: tokens.length,
                tokens: tokens.map(token => {
                    return {
                        _id: token._id,
                        Nombre_token: token.nombre_token,
                        nota_recordatoria: token.nota_recordatoria,
                        fecha_creacion: token.fecha_creacion,
                        token_url: token._id + separador + token.nombre_token + tipo

                    }
                })
            };
            res.status(200).json(response);
        })

    .catch(error => {
        next(error);
    })

};

exports.deleteToken = (req, res, next) => {
    const tokenId = req.params.id_token;
    Token
        .remove({ _id: tokenId })
        .exec()
        .then(result => {
            res.status(200).json({
                message: 'Token eliminado correctamente',
                result: result
            });
        })
        .catch(error => {
            next(error);
        });
};

exports.generateFile = (req, res, next) => {
    //esta funcion a través del next recibirá el id del usuario, para que se crea la carpeta en donde van a estar los tokens genereados  
    data = req.decoded;
    let token_data = req.body.token;
    var file_name = 'generic_token.xlsx';
    var file_name_dos = 'generic_token_copied.xlsx';
    var src = './app/files/generic/' + file_name;
    var dest = './app/files/tokens_generated/temp/' + file_name_dos;
    var dest_dos = './app/files/tokens_generated/tokens_users';
    const path = require('path');
    const hostname = req.headers.host;
    var path_final = '';
    payload = {

        id: data.user._id,
        name: data.user.name,
        apellido_pat: data.user.apellido_pat,
        apellido_mat: data.user.apellido_mat,
        email: data.user.email,
        phone: data.user.phone,
        id_token: token_data._id

    }
    var token_dos = jwt.sign(
        payload, CONFIG.SECRET_TOKEN, {
            expiresIn: '7d'
        });
    fs.copyFile(src, dest, (err) => {
        if (err) {
            console.log("Error Found:", err);
        } else {
            var workbook = new Excel.Workbook();
            workbook.xlsx.readFile(dest).then(function() {
                var worksheet = workbook.getWorksheet(1);
                var row_uno = worksheet.getRow(1500);
                var row_dos = worksheet.getRow(1501);
                var end_point = '/api_v1/tokens/token/alarma';
                let api_point = hostname + end_point;
                var token_generated = token_dos;
                row_uno.getCell(5).value = token_generated; // A5's value set to 5
                row_dos.getCell(5).value = api_point;
                row_uno.commit();
                row_dos.commit();
                const tokenPath = data.user._id.toString();
                const token_id_path = token_data._id.toString();
                const uploadDir = path.join(dest_dos, tokenPath);
                const dir_final = path.join(uploadDir, token_id_path);
                // Check directory and create (if needed)
                checkDirectorySync(dir_final);
                path_final = dir_final + `/${token_data.nombre_token}.xlsx`;
                // save the content in a new file (formulas re-calculated)
                workbook.xlsx.writeFile(path_final);
                delete_file(dest); //para borrar el archivo temporal
            });
        }
    });
    res.json({
        success: true,
        message: 'Token generado con éxito'
    });
};

exports.getTokenFile = (req, res, next) => {
    const path = require('path');
    const dinname = path.join(__dirname, '../')
    const id_user = req.decoded.user._id;
    const id_token = req.params.id_token;
    const fileName = req.params.name_file;
    const separador = '/';
    var path_file = '/files/tokens_generated/tokens_users';
    path_final = dinname + path_file;
    const directoryPath = path_final + separador + id_user + separador + id_token + separador + fileName;
    res.download(directoryPath, (error) => {
        if (error) {
            res.status(500).send({
                message: "Could not download the file. " + err
            })
        }
    });
};
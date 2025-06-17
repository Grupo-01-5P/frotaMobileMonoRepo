import * as yup from 'yup';

export default yup.object().shape({
    placa: yup.string().required('Placa é obrigatório'),
    marca: yup.string().required(),
    modelo: yup.string().required(),
    anoFabricacao: yup.number().integer().min(1900).max(new Date().getFullYear() + 1).required(),
    anoModelo: yup.number().integer().min(1900).max(new Date().getFullYear() + 1).required(),
    cor: yup.string().required(),
    renavam: yup.string().length(11).required(),
    chassi: yup.string().length(17).required(),
    empresa: yup.string().required(),
    departamento: yup.string().required(),
    tipoVeiculo: yup.string().oneOf(['carro','moto', 'caminhão', 'ônibus', 'van']).required(),
    supervisorId: yup.number().integer().positive(),
});

////////////////////////////////////////////////////////////////////////////////////////
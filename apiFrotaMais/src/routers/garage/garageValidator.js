import * as yup from 'yup';

const cnpjRegex = /^\d{14}$/;

export default yup.object().shape({
  nome: yup.string().required('O nome da oficina é obrigatório.'),
  cnpj: yup.string()
    .matches(cnpjRegex, 'O CNPJ deve conter exatamente 14 números.')
    .required('O CNPJ é obrigatório.'),
  rua: yup.string().required('A rua é obrigatória.'),
  bairro: yup.string().required('O bairro é obrigatório.'),
  cidade: yup.string().required('A cidade é obrigatória.'),
  estado: yup.string()
    .length(2, 'O estado deve ter 2 caracteres.')
    .required('O estado é obrigatório.'),
  email: yup.string().email('Email inválido.').required('O email é obrigatório.'),
  telefone: yup.string().required('O telefone é obrigatório.'),
  recebeEmail: yup.boolean().required('O campo recebeEmail é obrigatório.'),
});

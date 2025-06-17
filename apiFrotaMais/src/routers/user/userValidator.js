import * as yup from 'yup';

// Definir o validador para a entidade Usuario
export default yup.object().shape({
  nome: yup.string().required('Nome é obrigatório'),
  email: yup.string().email('Email inválido').required('Email é obrigatório'),
  login: yup.string().min(3, 'Login deve ter pelo menos 3 caracteres').required('Login é obrigatório'),
  senha: yup.string().min(6, 'Senha deve ter pelo menos 6 caracteres').required('Senha é obrigatória'),
  funcao: yup.string().oneOf(['supervisor', 'analista'], 'Função deve ser "supervisor" ou "analista"').required('Função é obrigatória'),
});
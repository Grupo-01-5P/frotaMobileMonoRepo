import * as yup from 'yup';

// Definir o validador para a entidade Orcamento
export default yup.object().shape({
  manutencaoId: yup.number().integer('ID da manutenção deve ser um número inteiro').required('Manutenção ID é obrigatório'),
  oficinaId: yup.number().integer('ID da oficina deve ser um número inteiro').required('Oficina ID é obrigatório'),
  descricaoServico: yup.string().required('Descrição do serviço é obrigatória'),
  valorMaoObra: yup.number().positive('Valor da mão de obra deve ser um número positivo').required('Valor da mão de obra é obrigatório'),
  produtos: yup.array().of(
    yup.object().shape({
      produtoId: yup.number().integer('ID do produto deve ser um número inteiro').required('Produto ID é obrigatório')
    })
  )
});

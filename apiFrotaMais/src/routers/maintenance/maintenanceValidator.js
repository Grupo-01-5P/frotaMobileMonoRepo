import * as yup from 'yup';

export default yup.object().shape({
  veiculoId: yup
    .number()
    .integer()
    .required('O ID do veículo é obrigatório.'),

  descricaoProblema: yup
    .string()
    .min(10, 'A descrição deve ter no mínimo 10 caracteres.')
    .required('A descrição do problema é obrigatória.'),

  // Substituir 'localizacao' por 'latitude' e 'longitude'
  latitude: yup
    .number()
    .min(-90, 'Latitude deve estar entre -90 e 90.')
    .max(90, 'Latitude deve estar entre -90 e 90.')
    .nullable()
    .required('A latitude é obrigatória.'),

  longitude: yup
    .number()
    .min(-180, 'Longitude deve estar entre -180 e 180.')
    .max(180, 'Longitude deve estar entre -180 e 180.')
    .nullable()
    .required('A longitude é obrigatória.'),

  urgencia: yup
    .string()
    .oneOf(['baixa', 'média', 'alta'], 'Urgência deve ser: baixa, média ou alta.')
    .required('O nível de urgência é obrigatório.'),

  status: yup
    .string()
    .oneOf(['pendente', 'aprovada', 'reprovada', 'concluída'], 'Status inválido.') // Ajustado 'rejeitada' para 'reprovada' para manter consistência
    .default('pendente'),

  dataSolicitacao: yup
    .date()
    .default(() => new Date()),

  // Campos opcionais adicionados para completude
  dataAprovacao: yup
    .date()
    .nullable(),

  dataReprovacao: yup
    .date()
    .nullable(),

  motivoReprovacao: yup
    .string()
    .nullable()
    .when('status', {
      is: 'reprovada',
      then: yup.string().required('Motivo da reprovação é obrigatório quando o status é reprovada.')
    }),

  supervisorId: yup
    .number()
    .integer()
    .required('O ID do analista é obrigatório.'),
});
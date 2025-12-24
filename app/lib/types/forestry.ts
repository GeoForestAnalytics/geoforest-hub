// src/types/forestry.ts

export interface Projeto {
  id: number;
  nome: string;
  empresa: string;
  responsavel: string;
  dataCriacao: string;
  status: 'ativo' | 'arquivado' | 'deletado';
  licenseId: string;
}

export interface Parcela {
  id: number;
  idParcela: string; // Ex: P01
  nomeFazenda: string;
  nomeTalhao: string;
  status: 'pendente' | 'emAndamento' | 'concluida' | 'exportada';
  latitude?: number;
  longitude?: number;
  dataColeta: string;
  nomeLider: string;
}

export interface DiarioDeCampo {
  id: number;
  dataRelatorio: string;
  nomeLider: string;
  localizacaoDestino: string;
  abastecimentoValor: number;
  pedagioValor: number;
  kmRodados: number; // (kmFinal - kmInicial)
}
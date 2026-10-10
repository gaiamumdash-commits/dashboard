// Tipos dos Mapas mentais (migration 0059).

export type Mapa = {
  id: string;
  tenant_id: string;
  user_id: string;
  titulo: string;
  compartilhado: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type NoMapa = {
  id: string;
  mapa_id: string;
  /** null = ideia central (uma por mapa). */
  pai_id: string | null;
  ordem: number;
  texto: string;
  nota: string | null;
  recolhido: boolean;
  /** Posição arrastada na visão de mapa, RELATIVA ao pai (migration 0060).
   * null/ausente = layout automático. Nunca muda a hierarquia. */
  pos_x?: number | null;
  pos_y?: number | null;
  /** Aparência escolhida no ramo (migration 0060); null = automática. */
  cor?: CorRamo | null;
  forma?: FormaRamo | null;
};

export const CORES_RAMO = ["roxo", "verde-agua", "coral", "azul", "amarelo", "lima", "verde", "laranja"] as const;
export type CorRamo = (typeof CORES_RAMO)[number];
export type FormaRamo = "caixa" | "linha";

/** Mover um ramo: subir/descer entre os irmãos, entrar no irmão de cima
 * (vira filho dele) ou sair do pai (vira irmão do pai). */
export type MovimentoNo = "cima" | "baixo" | "dentro" | "fora";

/** Limites espelhados do banco (CHECK e trigger da migration 0059). */
export const MAX_NOS_POR_MAPA = 500;
export const MAX_TEXTO_NO = 200;
export const MAX_NOTA_NO = 2000;

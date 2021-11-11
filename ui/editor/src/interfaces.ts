import { Role } from 'shogiground/types';

export interface OpeningPosition {
  eco?: string;
  name: string;
  fen: string;
  epd?: string;
}

export interface EditorConfig {
  baseUrl: string;
  fen: string;
  options?: EditorOptions;
  pieceNotation: number;
  animation: {
    duration: number;
  };
  embed: boolean;
  positions?: OpeningPosition[];
  i18n: any;
}

export interface EditorOptions {
  orientation?: Color;
  onChange?: (fen: string) => void;
  inlineCastling?: boolean;
}

export interface EditorState {
  fen: string;
  legalFen: string | undefined;
  playable: boolean;
}

export type Redraw = () => void;

export type Selected = 'pointer' | 'trash' | [Color, Role];

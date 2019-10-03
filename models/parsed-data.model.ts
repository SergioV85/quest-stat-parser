export interface ParsedGameInfo {
  start: string;
  finish: string;
  timezone: string;
  name: string;
}
export interface ParsedGameData extends ParsedGameInfo {
  domain: string;
  id: number;
}

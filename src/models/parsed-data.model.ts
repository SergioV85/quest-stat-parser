import { GroupedTeamData, TeamData, LevelData } from '.';

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

export interface ParsedGameStat {
  dataByTeam: GroupedTeamData[];
  dataByLevels: GroupedTeamData[];
  finishResults: TeamData[];
  levels: LevelData[];
}

export interface GamePayload {
  info: ParsedGameData;
  stat: ParsedGameStat;
}

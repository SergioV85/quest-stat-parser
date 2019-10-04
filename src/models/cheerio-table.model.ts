export interface CheerioTable extends Cheerio {
  parsetable(dupCols: boolean, dupRows: boolean, textMode: boolean): string[][];
}

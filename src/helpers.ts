
export class DateToSecTransformer {
    // Преобразование даты в секунды с начала эпохи
    to(value: Date): number {
      return Math.floor(value.getTime() / 1000);
    }
  
    // Преобразование обратно: секунды в дату
    from(value: number): number {
      return value;
    }
  }
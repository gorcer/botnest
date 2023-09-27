export class DefaultTestRepository {
  items = {};

  find(where) {
    if (!where) return Object.values(this.items);

    return Object.values(this.items).filter((item) => {
      for (const [key, value] of Object.entries(where)) {
        if (item[key] != value) {
          return false;
        }
      }
      return true;
    });
  }

  findOneBy(where) {
    const items = this.find(where);
    if (items.length > 0) return items[0];
  }

  create(data) {
    return data;
  }

  save(item) {
    if (!item.id) item.id = Object.keys(this.items).length + 1;

    this.items[item.id] = item;
  }
}

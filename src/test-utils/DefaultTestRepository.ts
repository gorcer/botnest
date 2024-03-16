import { clone, updateModel } from "../helpers/helpers";

export class DefaultTestRepository {
  items = {};
  defaults = {};

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
    const item = clone(this.defaults);
    updateModel(item, data);

    return this.save(item);
  }

  save(item) {
    if (!item.id) 
      item.id = Object.keys(this.items).length + 1;

    this.items[item.id] = item;
    return item;
  }

  setDefault(defaults) {
    this.defaults = defaults;
  }
}

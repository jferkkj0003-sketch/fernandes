// Keep database IDs as identity. Names are only a fallback for local demo records.
export const driverKey = (driver) => driver.id || driver.name || '';
export const recordDriverKey = (record) => record.driverId || record.driver || '';
export const matchesDriver = (record, driver) =>
  record.driverId && driver.id ? record.driverId === driver.id : record.driver === driver.name;

export function driverOptions(drivers, tickets = []) {
  const options = new Map(drivers.map((driver) => [driverKey(driver), {
    key: driverKey(driver), name: driver.name, active: driver.active !== false,
  }]));
  for (const ticket of tickets) {
    const key = recordDriverKey(ticket);
    if (key && !options.has(key)) options.set(key, { key, name: ticket.driver, active: true });
  }
  return [...options.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}


/**
 * TEMPORARY amend-CSV seeder for the DROP emulator.
 *
 * Overwrites the prerendered download lists so /data/download returns ONLY the
 * 65 EMAIL records from the Cal DROP amend-errors report used by the fidesplus
 * seed notebook (fides_uploads/drop_seed_warehouse_from_csv.ipynb):
 *   - Email.csv  -> the 65 (Id, Hash) rows below (Hash = DROP's own hash).
 *   - all other lists -> header only (0 records).
 *   - manifest   -> count 65.
 *
 * Records are DROP work-item Id + Hashed Email, verbatim from
 * 20260625064417_1503_EMAIL_Amend_Errors.csv (rows Expected 2 or 3). Regenerate
 * with:  npm run seed:amend
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config } from "../src/lib/config";
import { fileLabel, LIST_TYPES, ListType } from "../src/lib/lists";

// [workItemId, emailHash] — the 65 EMAIL records DROP expects us to match.
const EMAIL_RECORDS: [string, string][] = [
  ["77570", "GE8IbOk6ZqJDkBVOH2tQrIfV6MFz5pBHYuloZx6OsLA="],
  ["77558", "DGp6Jz0RFa/kV6HlhVaAfYlMWQlA+23TH86uFzgcLNQ="],
  ["77554", "jaaoWfjZiwyMbTAOb28eXhzna3IIMrmyd25NPNjDvIU="],
  ["77561", "HBM8hnMyB7MwuScIqAMYVaKdZ3/mIdJJeahYCZ0/f8w="],
  ["77553", "y5JYZcH68a4IdOzCgb/W7rsj2ryf5pn+QtIHFiFCxZE="],
  ["77511", "Pe/jrF872JTDI5nMt2gBLD/0lG6/SxxTWPAzK7bOXhc="],
  ["77546", "g8WNK2igGoZAmoxUxwC2ZI+wnmvUBlF4RCFJggjTrSw="],
  ["77583", "bQRhmvin0ZDD0X7gWM52oVOxY/rvXC9y1yrJOvb2fR0="],
  ["77577", "YLY1FUUvwFZSwpj5ZPJX0eKglbNqHSTCLT+LsGK65y4="],
  ["77518", "hUsPB3g88sbhKShE+M+lpjRrFjY4DWSvWqGQ4U7iMKw="],
  ["77557", "ukqoyEV3+CTBKQo3mkl8Hegwk68zy13CTGzloE83t6Q="],
  ["77543", "SUMS/QXL8t26J4MXfN27gyV43y8i17ys3amgbg0jNjI="],
  ["77591", "4InYoQQaA83OciSj2RkDHsKe2s13uOMalPyf4xw4coY="],
  ["77529", "HsPnm0mAkWXUhXD96NHZ5lCTsNrQUGEbGeu08BKZmsE="],
  ["77581", "O+E9mM4Nrs4FYvF0iHGMHa9igAHum+Gwsq3AekxKl9M="],
  ["77512", "YUlUSNRRbB4pZDiAbgc5UpsGY0pMQshPoyDiwXe48ps="],
  ["77520", "+wu5HzradO6NEuWBhkvV+03k8kfj8svYvTsrgucpI0c="],
  ["77534", "Hv9H7y5KdlRWx/jPeNPHSZ6BSxjgct4NCIDh/ZEVnao="],
  ["77588", "I0t5Fj7naBBQnZs+Y0IivyWia9B4L/OaNKDNKfrxx48="],
  ["77516", "olSgLtTTaAtvUDqbTmPAmTdzPg/03YDk1bXZyNjGd20="],
  ["77517", "yNmyOhkj4A53wBDYPi7PMY9Jx1kwyvc6okYeznoWl/Q="],
  ["77548", "egd2QkHaaSJruIlcJFD/QHhoW8h7K72jIy/Bs4WiWj0="],
  ["77573", "yjE+GUUk5a0dnEhyHMdHhDKwtaBWK40L31TRkPWL3hI="],
  ["77567", "avWPSZ0yN8UDYN4/zxrgK+4crWwx2XM54ibWCE2GQ78="],
  ["77586", "XgfQkdcZAA6Bui8C4un0KXm1J1MdwLYsvhjlSmK/syU="],
  ["77566", "wSJ5GUzdIpF/lDuuRAJ3qDknaQ4tnxEcpTCy3ehc+Tw="],
  ["77544", "0XerWbhHOyJTZl5Y+rniWbL4r89sHENf5g4T4EXsZC8="],
  ["77515", "WV+y8Ovz6kGlIvoL5BaUhWimChk7Rk0jbqrI335FtF4="],
  ["77513", "fGCLVvT4wqpiUc2wjjeG/xzkYMtdJjjF9euZK/JBEsE="],
  ["77527", "FrV6WGJnsVHUePQDcraQ8+eSRHeOBdoDJC1ivORVTsc="],
  ["77539", "o5g9uXXC2cxzxq4n4O6iYQDFIghlU5dnPf1Al4dolxY="],
  ["77574", "MXFr6N14DIhIWZ/d9XbQk9rHLG7iVp6ddCg6kgItgx0="],
  ["77510", "eKts5C7ixkerPkBlVHFoVSqEbOMh87RTqzhHdsyrvz4="],
  ["77526", "9BTv3wjeV+E6OpoDTAEjGBKu528MJkDHO/waWJbNVQc="],
  ["77576", "BAUk5QUD0X8ZpERG+nzrbdI7B7yeuN0rBf1t8YI4U/U="],
  ["77545", "eJ+vJ/VvmgLL3ks4hf0RnsBntA5DNvGTFomTJZGeYmU="],
  ["77590", "SNoBW1AREnkjzBJJ0En+ZYqy/5Z3WpQpOtw8Hux9Vew="],
  ["77597", "NUxXFZvXUnwqDBfiq6UmOoRLiaRCOIgse8xktKeytWM="],
  ["77580", "U1TKugm5sEE/RUDTk88TI+WAv0CZbcjndOWAAcYpwUU="],
  ["77582", "l5jTH3ZBrzGznuvQxsbVg4ov6sgcAjYK8HPly6MKjMo="],
  ["77601", "Xdvo0HLBdIWRfam86oJgqAUS4Tszw+4hsp57a4vR+r0="],
  ["77551", "F+5bM2gyl0SnWZFVp1rxXTyptD9TTTqGe/ISIDaSyt8="],
  ["77578", "79kV6MN+v1WZCVwloO/4MzXx00wFPJFlSJjIowLQ1Y8="],
  ["77541", "6oZ/eOpMhSYU3osOzBluWwTNG+b8t+h/Dq+qInQOBhk="],
  ["77587", "xg7lR3WKb/N8hy1sX7HjdFjtqupJXYj5Vm0fQ+soQUs="],
  ["77565", "QCpomiqwKy7cEd1cRSPXwYLDWW2HaW/ZjJnk/GVT5qU="],
  ["77528", "19sf9X8MnU0PQiPYlPBhxTyX1FwNaXwHtel7d+YN7Vg="],
  ["77547", "ya8OBt9z/tUsLF8krgyBaiSFpeUsVeH6C4pMaFgLXCY="],
  ["77589", "5hVR76SF6hC/JPyYm2AIm7ZBCTWrLAuVPShbTQm80mE="],
  ["77592", "iBVI5W0rF7FksNrWY60iMzKLhElze1G++K8+dWc8W84="],
  ["77509", "XC0SLvdhFduj7Leib6t2Li/+5DKK9AqtXxU1FdfWnSE="],
  ["77594", "2NVJImLj9bucLnfk9H0ePwByWbLDw+KZxuIgWM/A21M="],
  ["77531", "R4nSuhijg3fN88O9NFjchDpeS8xpEu/U3pK3cs0HIY8="],
  ["77537", "n79vgUSsjdAaYE03lO90wjvTV5xlhrphSfMk9IUJydY="],
  ["77525", "lxgDDneUZeI819447Z2wmY24jSHLIB8yar3YsyLLhmA="],
  ["77507", "vcc9C3T2GU+jF4pnHephxHrx7WzZpTN4ebg+4GJSzBY="],
  ["77571", "uWd10YiiL60O98++NINK0m7hJq2JwXgMbH/MaWZwB94="],
  ["77522", "qpVoLlHe705GiqxQsKd3lavYRx2j+Tr8WKvj82hd8LE="],
  ["77559", "tGMtCIYxlyXFD5MiknJh7fK21bip41KpEazf04JqPG4="],
  ["77536", "SK14aXWaHW/xDp8sbN5VFrwwmrRRyIu1DYDHNFvW7H4="],
  ["77568", "E8LHKLBeHIPxRVtLBuKxYCHdalhpIPSX4xxFukw7nG8="],
  ["77569", "36eSWAGUyP0Bhbp+ub+tnRgLj1fTOB+b7mq4UTip5Tg="],
  ["77542", "lBWyjz4Ph5/ibrIpI1Ytbmu53fqdX99tx8707W/zx3A="],
  ["77598", "hKGIPzMqwKOAccOypzuO8JU+W9oWEJOPv7pWIaqKZ8E="],
  ["77550", "M/0pXgf53yw+AVEWf4sYXoedTNbAn7miH7lWPHpJvYU="],
];

function listsDir(): string {
  return path.join(config.dataDir, "lists");
}

function seedAmend(): void {
  mkdirSync(listsDir(), { recursive: true });
  for (const listType of LIST_TYPES) {
    const file = path.join(listsDir(), `${fileLabel(listType)}.csv`);
    if (listType === ListType.EMAIL) {
      const body =
        "Id,Hash\n" + EMAIL_RECORDS.map(([id, h]) => `${id},${h}`).join("\n") + "\n";
      writeFileSync(file, body, "utf8");
    } else {
      // Other lists deliver nothing — the notebook only seeds EMAIL.
      writeFileSync(file, "Id,Hash\n", "utf8");
    }
  }
  writeFileSync(
    path.join(listsDir(), "manifest.json"),
    JSON.stringify({ count: EMAIL_RECORDS.length }),
    "utf8",
  );
  console.log(`[caldrop] seeded ${EMAIL_RECORDS.length} EMAIL records; other lists empty`);
}

seedAmend();

import PptxGenJS from "pptxgenjs";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(__dirname, "screenshots-uk");
const OUT = join(__dirname, "streamassist-deck-uk.pptx");

const NOTES = {
  1: "Я Богдан, я стрімер. Роман — мій кофаундер-дизайнер. У наступні три хвилини покажу, чому наступне покоління live-шоу працює на платформі — а не на стеку склеєних інструментів.",
  2: "Дві сторони одного шоу. Зліва — те, що бачать глядачі. Справа — те, з чим стрімер бореться зараз: 6 інструментів, 3 аудіо-джерела, Notion 'Mafia rules v17 FINAL FINAL v3'. Більшість стрімерів у цій кімнаті пережили цей кадр сьогодні.",
  3: "Шість місць, де стек ламається: сетап, аудиторія, колаби, ігри, кліпи, гроші. Запам'ятайте останній — гроші відірвані від інтеракції, яка їх заробляє.",
  4: "Три тренди в одному вікні. Глядачі хочуть грати. Гроші перейшли direct-to-creator. AI здешевив нові формати. Усі три правдиві зараз, уперше.",
  5: "Один продукт. Сім шарів. Чотири побудовані. Економіка — primitives. Кліпи — 6 місяців. AI — рік. Ми ніколи не вдаємо, що дорожня карта — це продукт.",
  6: "Один цикл — від ідеї до кліпу. Креатор → учасники → гра → глядачі → кліп → нова аудиторія. Усе у одному продукті.",
  7: "12 стрімерів у пілотному колі. 5 ігрових форматів. 12-камерний live-тест ~3 години. 4 локалі. Запитували — без нашої підказки. Ринок просить наступне.",
  8: "B2B2C. Стрімери приносять довіру, глядачі — масштаб. Та сама монета, яку глядач витратив на шоу, фінансує платформу.",
  9: "Чотири цикли. Цикл №3 — вірусні кліпи — той, на який ставимо. 6 місяців, чітко позначено.",
  10: "Три сторони. Free / Plus $3.99 / Pro $6.99 / Studio пізніше. Економіка глядачів — рейки сьогодні. Промокоди live, rev share later. MRR не цитую.",
  11: "Три сценарії, кінець 1 року. Conservative $435, Base $3 750, Optimistic $32 750. Економіка глядачів стає більшою половиною з ростом. Оціночна модель — не прогноз.",
  12: "$90k базовий бюджет. Робочий запит $80–120k на 12–18 місяців. Optimistic окупається ~M11, Base ~M21, Conservative — не в межах 24 міс.",
  13: "Зараз — стабільність. 6 місяців — лояльність + кліпи. Рік — Creator OS + AI. Не будуємо ще: marketplace, AI co-host, gambling-економіка.",
  14: "8 ризиків. Високих три: realtime, retention, Twitch/Kick API. Не приховуємо — показуємо як знижуємо.",
  15: "Два фаундери. Я будую, Роман дизайнить. Запит: $80–120k pre-seed на 12–18 місяців runway. Відповідаю в межах 48 годин."
};

const pres = new PptxGenJS();
pres.layout = "LAYOUT_WIDE";
pres.title = "StreamAssist — Інвестиційний дек";
pres.author = "Богдан Надебернюй";
pres.company = "StreamAssist";

let added = 0, missing = [];
for (let i = 1; i <= 15; i++) {
  const n = String(i).padStart(2, "0");
  const imgPath = join(SHOTS, `slide-${n}.png`);
  const slide = pres.addSlide();
  slide.background = { color: "0A0B14" };
  if (existsSync(imgPath) && statSync(imgPath).size > 0) {
    slide.addImage({ path: imgPath, x: 0, y: 0, w: 13.333, h: 7.5 });
    added++;
  } else {
    missing.push(i);
  }
  slide.addNotes(NOTES[i] || "");
}

await pres.writeFile({ fileName: OUT });
console.log(`PPTX: ${OUT} · ${added} slides`);
if (missing.length) console.log(`missing: ${missing.join(", ")}`);

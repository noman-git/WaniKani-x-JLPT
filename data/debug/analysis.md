# JLPT Data Analysis Report

## Summary

| Metric | N5 | N4 |
|--------|----|----|
| JLPTsensei kanji count | 80 | 167 |
| Our kanji count | 121 | 77 |
| Our vocab count | 581 | 584 |
| Missing kanji (vs sensei) | 37 | 156 |
| Extra kanji (not in sensei) | 78 | 66 |
| Missing but classified as vocab | 8 | 6 |
| Missing completely from DB | 25 | 111 |
| Missing but in other level | 6 | 42 |
| Single-char vocab (should be kanji too) | 22 | 14 |

## Problem 1: Missing N5 Kanji (37 missing vs JLPTsensei's 80)

### Missing N5 kanji classified as vocab in our data:
- **日** — ～にち — ~ day of the month, for ~ days (in our DB as N5 vocab)
- **人** — ～じん — counter for people (in our DB as N5 vocab)
- **中** — ～じゅう — inside, middle, among (in our DB as N5 vocab)
- **時** — ～じ — ~ o'clock (time) (in our DB as N5 vocab)
- **月** — ～つき — month (in our DB as N4 vocab)
- **分** — ～ふん — ~ minutes (in our DB as N5 vocab)
- **円** — ～えん — Yen (in our DB as N5 vocab)
- **語** — ～ご — word, language (in our DB as N5 vocab)

### Missing N5 kanji classified under N4 in our data:
- **日** — ひ — sun, sunshine, day (in our DB as N4 kanji)
- **月** — ～つき — month (in our DB as N4 vocab)
- **間** — あいだ — space, interval (in our DB as N4 kanji)
- **子** — こ — child (in our DB as N4 kanji)
- **気** — き — spirit, mood (in our DB as N4 kanji)
- **火** — ひ — fire (in our DB as N4 kanji)

### Missing N5 kanji completely absent from our DB:
- **大**
- **長**
- **出**
- **行**
- **見**
- **生**
- **金**
- **入**
- **学**
- **高**
- **来**
- **小**
- **午**
- **書**
- **名**
- **電**
- **校**
- **土**
- **聞**
- **食**
- **毎**
- **天**
- **読**
- **友**
- **休**

### Extra kanji in our N5 list (not in JLPTsensei):
- **体** — からだ — body; health
- **傘** — かさ — umbrella, parasol
- **兄** — あに — (my) older brother (humble)
- **冬** — ふゆ — winter
- **卵** — たまご — egg
- **口** — くち — job opening; mouth
- **塩** — しお — salt
- **声** — こえ — voice
- **夏** — なつ — summer
- **夜** — よる — evening, night
- **妹** — いもうと — younger sister (humble)
- **姉** — あね — (my) older sister (humble)
- **嫌** — いや — disagreeable, detestable, unpleasant
- **家** — いえ — house, home
- **店** — みせ — store, shop
- **庭** — にわ — garden
- **弟** — おとうと — younger brother
- **戸** — と — door (Japanese style)
- **所** — ところ — place
- **手** — て — hand
- **方** — かた — -- honorific form for 人 (ひと) --; way of doing
- **春** — はる — spring
- **昼** — ひる — noon, daytime
- **晩** — ばん — evening
- **暇** — ひま — free time, leisure
- **服** — ふく — clothes
- **朝** — あさ — morning
- **机** — つくえ — desk
- **村** — むら — village
- **横** — よこ — beside; side; width
- **橋** — はし — bridge
- **次** — つぎ — next
- **歌** — うた — a song
- **歯** — は — tooth
- **池** — いけ — pond
- **海** — うみ — sea, beach
- **物** — もの — thing (concrete object)
- **犬** — いぬ — dog
- **猫** — ねこ — cat
- **町** — まち — town; city
- **目** — め — eye(s)
- **私** — わたし — I (formal), myself, private affairs
- **秋** — あき — fall (season)
- **空** — そら — sky
- **窓** — まど — window
- **箱** — はこ — box
- **箸** — はし — chopsticks
- **紙** — かみ — paper
- **絵** — え — a painting; a picture; a drawing
- **緑** — みどり — green
- **耳** — みみ — ear
- **肉** — にく — meat
- **背** — せい — (one's) height, stature
- **色** — いろ — color
- **花** — はな — flower
- **薬** — くすり — medicine
- **角** — かど — corner (e.g., desk, pavement)
- **誰** — だれ — who
- **赤** — あか — red
- **足** — あし — foot; leg
- **辺** — へん — area, vicinity
- **道** — みち — road, street; way, directions
- **鍵** — かぎ — a lock; a key
- **門** — もん — gate
- **隣** — となり — next to, next door to
- **雪** — ゆき — snow
- **零** — れい — zero, nought
- **青** — あお — blue
- **靴** — くつ — shoes, footwear
- **頭** — あたま — head
- **顔** — かお — face (body part)
- **風** — かぜ — wind, breeze
- **飴** — あめ — (hard) candy
- **駅** — えき — station
- **魚** — さかな — fish
- **鳥** — とり — chicken (lit., bird)
- **黒** — くろ — black
- **鼻** — はな — nose

## Problem 2: Missing N4 Kanji (156 missing vs JLPTsensei's 167)

### Missing N4 kanji classified as vocab in our data:
- **会** — ～かい — ~ meeting (in our DB as N4 vocab)
- **員** — ～いん — member of ~ (in our DB as N4 vocab)
- **代** — ～だい — ~ age; period (in our DB as N4 vocab)
- **目** — ～め — number ~ sequence, ~nd; ~th (in our DB as N4 vocab)
- **家** — ～か — person who is specialized in ~ (in our DB as N4 vocab)
- **町** — ～ちょう — the town of ~ (in our DB as N4 vocab)

### Missing N4 kanji classified under N5 in our data:
- **方** — かた — -- honorific form for 人 (ひと) --; way of doing (in our DB as N5 kanji)
- **手** — て — hand (in our DB as N5 kanji)
- **目** — め — eye(s) (in our DB as N5 kanji)
- **体** — からだ — body; health (in our DB as N5 kanji)
- **度** — ～ど — counter for occurrences; ~ degree; ~ point (in our DB as N5 vocab)
- **家** — いえ — house, home (in our DB as N5 kanji)
- **海** — うみ — sea, beach (in our DB as N5 kanji)
- **道** — みち — road, street; way, directions (in our DB as N5 kanji)
- **物** — もの — thing (concrete object) (in our DB as N5 kanji)
- **私** — わたし — I (formal), myself, private affairs (in our DB as N5 kanji)
- **朝** — あさ — morning (in our DB as N5 kanji)
- **台** — ～だい — counter for vehicles; machines (in our DB as N5 vocab)
- **口** — くち — job opening; mouth (in our DB as N5 kanji)
- **町** — まち — town; city (in our DB as N5 kanji)
- **空** — そら — sky (in our DB as N5 kanji)
- **足** — あし — foot; leg (in our DB as N5 kanji)
- **店** — みせ — store, shop (in our DB as N5 kanji)
- **兄** — あに — (my) older brother (humble) (in our DB as N5 kanji)
- **冬** — ふゆ — winter (in our DB as N5 kanji)
- **夏** — なつ — summer (in our DB as N5 kanji)
- **夜** — よる — evening, night (in our DB as N5 kanji)
- **妹** — いもうと — younger sister (humble) (in our DB as N5 kanji)
- **姉** — あね — (my) older sister (humble) (in our DB as N5 kanji)
- **屋** — ～や — ~ shop (in our DB as N5 vocab)
- **弟** — おとうと — younger brother (in our DB as N5 kanji)
- **春** — はる — spring (in our DB as N5 kanji)
- **昼** — ひる — noon, daytime (in our DB as N5 kanji)
- **服** — ふく — clothes (in our DB as N5 kanji)
- **歌** — うた — a song (in our DB as N5 kanji)
- **犬** — いぬ — dog (in our DB as N5 kanji)
- **秋** — あき — fall (season) (in our DB as N5 kanji)
- **紙** — かみ — paper (in our DB as N5 kanji)
- **肉** — にく — meat (in our DB as N5 kanji)
- **色** — いろ — color (in our DB as N5 kanji)
- **花** — はな — flower (in our DB as N5 kanji)
- **赤** — あか — red (in our DB as N5 kanji)
- **青** — あお — blue (in our DB as N5 kanji)
- **風** — かぜ — wind, breeze (in our DB as N5 kanji)
- **駅** — えき — station (in our DB as N5 kanji)
- **魚** — さかな — fish (in our DB as N5 kanji)
- **鳥** — とり — chicken (lit., bird) (in our DB as N5 kanji)
- **黒** — くろ — black (in our DB as N5 kanji)

### Missing N4 kanji completely absent from our DB:
- **同**
- **自**
- **社**
- **発**
- **者**
- **地**
- **業**
- **新**
- **場**
- **立**
- **開**
- **問**
- **明**
- **動**
- **京**
- **通**
- **言**
- **理**
- **田**
- **主**
- **題**
- **意**
- **不**
- **作**
- **強**
- **公**
- **持**
- **野**
- **以**
- **思**
- **世**
- **多**
- **正**
- **安**
- **院**
- **界**
- **教**
- **文**
- **元**
- **重**
- **近**
- **考**
- **画**
- **売**
- **知**
- **集**
- **使**
- **品**
- **計**
- **死**
- **特**
- **始**
- **運**
- **終**
- **広**
- **住**
- **無**
- **真**
- **有**
- **少**
- **料**
- **工**
- **建**
- **止**
- **送**
- **切**
- **転**
- **研**
- **究**
- **楽**
- **起**
- **着**
- **病**
- **質**
- **仕**
- **借**
- **写**
- **勉**
- **医**
- **去**
- **古**
- **図**
- **堂**
- **夕**
- **室**
- **帰**
- **待**
- **悪**
- **旅**
- **族**
- **早**
- **映**
- **曜**
- **歩**
- **注**
- **洋**
- **漢**
- **牛**
- **習**
- **英**
- **茶**
- **試**
- **買**
- **貸**
- **走**
- **週**
- **銀**
- **飯**
- **飲**
- **館**
- **験**

### Extra kanji in our N4 list (not in JLPTsensei):
- **倍** — ばい — double
- **僕** — ぼく — I (used by men towards those of equal or lower status)
- **億** — おく — hundred million
- **光** — ひかり — light
- **内** — うち — within, inside
- **君** — きみ — Mr. (junior) ~, master ~
- **喉** — のど — throat
- **嘘** — うそ — lie
- **坂** — さか — slope, hill
- **堅** — かたい — solid, hard, firm
- **壁** — かべ — wall
- **変** — へん — strange, odd
- **夢** — ゆめ — a dream
- **夫** — おっと — husband
- **妻** — つま — wife (humble)
- **娘** — むすめ — daughter (humble)
- **子** — こ — child
- **客** — きゃく — guest, customer
- **寺** — てら — Buddhist temple
- **島** — しま — island
- **市** — し — city
- **席** — せき — a seat
- **形** — かたち — shape
- **彼** — かれ — he, boyfriend
- **指** — ゆび — finger
- **日** — ひ — sun, sunshine, day
- **昔** — むかし — old days; past
- **星** — ほし — star
- **林** — はやし — woods, forest
- **枝** — えだ — branch, twig
- **棚** — たな — shelves, rack
- **森** — もり — forest
- **毛** — け — hair, fur
- **気** — き — spirit, mood
- **港** — みなと — harbor, port
- **湖** — みずうみ — lake
- **湯** — ゆ — hot water
- **火** — ひ — fire
- **点** — てん — mark, score, grade; point, dot
- **為** — ため — good, advantage, in order to
- **熱** — ねつ — fever, temperature
- **畳** — たたみ — tatami mat (Japanese straw mat)
- **皆** — みな — everyone
- **石** — いし — stone
- **砂** — すな — sand
- **程** — ほど — degree, extent
- **米** — こめ — uncooked rice
- **糸** — いと — thread
- **絹** — きぬ — silk
- **線** — せん — line, wire
- **腕** — うで — arm (in reference to body)
- **舟** — ふね — ship, boat
- **草** — くさ — grass
- **葉** — は — leaf
- **虫** — むし — insect
- **血** — ち — blood
- **表** — おもて — surface; front; outside
- **裏** — うら — reverse side, back
- **訳** — わけ — reason; explanation
- **都** — と — metropolitan
- **鏡** — かがみ — mirror
- **間** — あいだ — space, interval
- **隅** — すみ — corner
- **雲** — くも — cloud
- **首** — くび — neck
- **髪** — かみ — hair

## Problem 3: Single-character Vocab That Should Also Be Kanji

These are words in the vocab list that are a single kanji character — they should appear in the kanji list too.

### N5 single-char vocab (22):
- **お** — お～ — honorable ~ (honorific)
- **中** — ～じゅう — inside, middle, among
- **人** — ～じん — counter for people
- **個** — ～こ — counter for small items (e.g., fruits, cups)
- **側** — ～がわ — ~ side
- **円** — ～えん — Yen
- **冊** — ～さつ — counter for books
- **分** — ～ふん — ~ minutes
- **匹** — ～ひき — counter for small animals
- **台** — ～だい — counter for vehicles; machines
- **回** — ～かい — counter for occurrences (~ times)
- **屋** — ～や — ~ shop
- **度** — ～ど — counter for occurrences; ~ degree; ~ point
- **日** — ～にち — ~ day of the month, for ~ days
- **時** — ～じ — ~ o'clock (time)
- **月** — ～がつ — month of year
- **杯** — ～はい — counter for cupfuls
- **枚** — ～まい — counter for flat things
- **歳** — ～さい — ~ years old
- **番** — ～ばん — ~st; ~th best
- **語** — ～ご — word, language
- **階** — ～かい — counter for stories (floors) of a building

### N4 single-char vocab (14):
- **あ** — あ — Ah
- **代** — ～だい — ~ age; period
- **会** — ～かい — ~ meeting
- **区** — ～く — ~ district, ~ ward, ~ borough
- **員** — ～いん — member of ~
- **家** — ～か — person who is specialized in ~
- **式** — ～しき — ~ ceremony; ~ style
- **御** — ご～ — honorable ~
- **月** — ～つき — month
- **様** — ～さま — way, manner, kind
- **町** — ～ちょう — the town of ~
- **目** — ～め — number ~ sequence, ~nd; ~th
- **製** — ～せい — made in ~
- **軒** — ～けん — counter for houses

## Reference: JLPTsensei Complete Kanji Lists

### N5 Kanji (80):
日 一 国 人 年 大 十 二 本 中 長 出 三 時 行 見 月 分 後 前 生 五 間 上 東 四 今 金 九 入 学 高 円 子 外 八 六 下 来 気 小 七 山 話 女 北 午 百 書 先 名 川 千 水 半 男 西 電 校 語 土 木 聞 食 車 何 南 万 毎 白 天 母 火 右 読 友 左 休 父 雨

### N4 Kanji (167):
会 同 事 自 社 発 者 地 業 方 新 場 員 立 開 手 力 問 代 明 動 京 目 通 言 理 体 田 主 題 意 不 作 用 度 強 公 持 野 以 思 家 世 多 正 安 院 心 界 教 文 元 重 近 考 画 海 売 知 道 集 別 物 使 品 計 死 特 私 始 朝 運 終 台 広 住 無 真 有 口 少 町 料 工 建 空 急 止 送 切 転 研 足 究 楽 起 着 店 病 質 仕 借 兄 写 冬 勉 医 去 古 味 図 堂 夏 夕 夜 妹 姉 字 室 屋 帰 弟 待 悪 旅 族 早 映 春 昼 曜 服 歌 歩 注 洋 漢 牛 犬 秋 答 紙 習 肉 色 花 英 茶 親 試 買 貸 赤 走 週 銀 青 音 風 飯 飲 館 駅 験 魚 鳥 黒

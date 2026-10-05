// 195 countries: 193 UN members + Vatican + Palestine. [ISO code, Japanese name]
window.REGIONS = ['東アジア', '東南アジア', '南アジア', '中央アジア', '西アジア', 'ヨーロッパ', 'アフリカ', '北中米', '南米', 'オセアニア'];

(function () {
  const data = {
    '東アジア': 'JP日本 CN中国 KR韓国 KP北朝鮮 MNモンゴル',
    '東南アジア': 'BNブルネイ KHカンボジア IDインドネシア LAラオス MYマレーシア MMミャンマー PHフィリピン SGシンガポール THタイ TL東ティモール VNベトナム',
    '南アジア': 'AFアフガニスタン BDバングラデシュ BTブータン INインド MVモルディブ NPネパール PKパキスタン LKスリランカ',
    '中央アジア': 'KZカザフスタン KGキルギス TJタジキスタン TMトルクメニスタン UZウズベキスタン',
    '西アジア': 'AMアルメニア AZアゼルバイジャン BHバーレーン GEジョージア IRイラン IQイラク ILイスラエル JOヨルダン KWクウェート LBレバノン OMオマーン PSパレスチナ QAカタール SAサウジアラビア SYシリア TRトルコ AEアラブ首長国連邦 YEイエメン',
    'ヨーロッパ': 'ALアルバニア ADアンドラ ATオーストリア BYベラルーシ BEベルギー BAボスニア・ヘルツェゴビナ BGブルガリア HRクロアチア CYキプロス CZチェコ DKデンマーク EEエストニア FIフィンランド FRフランス DEドイツ GRギリシャ HUハンガリー ISアイスランド IEアイルランド ITイタリア LVラトビア LIリヒテンシュタイン LTリトアニア LUルクセンブルク MTマルタ MDモルドバ MCモナコ MEモンテネグロ NLオランダ MK北マケドニア NOノルウェー PLポーランド PTポルトガル ROルーマニア RUロシア SMサンマリノ RSセルビア SKスロバキア SIスロベニア ESスペイン SEスウェーデン CHスイス UAウクライナ GBイギリス VAバチカン',
    'アフリカ': 'DZアルジェリア AOアンゴラ BJベナン BWボツワナ BFブルキナファソ BIブルンジ CVカーボベルデ CMカメルーン CF中央アフリカ TDチャド KMコモロ CGコンゴ共和国 CDコンゴ民主共和国 CIコートジボワール DJジブチ EGエジプト GQ赤道ギニア ERエリトリア SZエスワティニ ETエチオピア GAガボン GMガンビア GHガーナ GNギニア GWギニアビサウ KEケニア LSレソト LRリベリア LYリビア MGマダガスカル MWマラウイ MLマリ MRモーリタニア MUモーリシャス MAモロッコ MZモザンビーク NAナミビア NEニジェール NGナイジェリア RWルワンダ STサントメ・プリンシペ SNセネガル SCセーシェル SLシエラレオネ SOソマリア ZA南アフリカ SS南スーダン SDスーダン TZタンザニア TGトーゴ TNチュニジア UGウガンダ ZMザンビア ZWジンバブエ',
    '北中米': 'AGアンティグア・バーブーダ BSバハマ BBバルバドス BZベリーズ CAカナダ CRコスタリカ CUキューバ DMドミニカ国 DOドミニカ共和国 SVエルサルバドル GDグレナダ GTグアテマラ HTハイチ HNホンジュラス JMジャマイカ MXメキシコ NIニカラグア PAパナマ KNセントクリストファー・ネイビス LCセントルシア VCセントビンセント・グレナディーン TTトリニダード・トバゴ USアメリカ',
    '南米': 'ARアルゼンチン BOボリビア BRブラジル CLチリ COコロンビア ECエクアドル GYガイアナ PYパラグアイ PEペルー SRスリナム UYウルグアイ VEベネズエラ',
    'オセアニア': 'AUオーストラリア FJフィジー KIキリバス MHマーシャル諸島 FMミクロネシア NRナウル NZニュージーランド PWパラオ PGパプアニューギニア WSサモア SBソロモン諸島 TOトンガ TVツバル VUバヌアツ'
  };
  const list = [];
  for (const region of Object.keys(data)) {
    for (const tok of data[region].split(' ')) {
      list.push({ code: tok.slice(0, 2), name: tok.slice(2), region });
    }
  }
  window.COUNTRIES = list;
  window.COUNTRY_BY_CODE = Object.fromEntries(list.map(c => [c.code, c]));
  // Flag emoji built from ISO code (regional indicator symbols)
  window.flagOf = code => String.fromCodePoint(...[...code].map(ch => 0x1F1A5 + ch.charCodeAt(0)));
})();

// Context rules, not AI or pronunciation scoring. Unknown answers stay unconfirmed.
export function normalizeSpeech(value) {
  return String(value ?? '').toLowerCase().replace(/’/g,"'")
    .replace(/\bi'm\b/g,'i am').replace(/\bit's\b/g,'it is').replace(/\bthat's\b/g,'that is')
    .replace(/\bdon't\b/g,'do not').replace(/\bisn't\b/g,'is not')
    .replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}
const number = '(?:[1-9]\\d?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an)';
const foods = 'chicken|beef|pork|fish|steak|rice|noodles|pasta|pizza|burger|salad|soup|sandwich|bread|eggs|vegetables|dessert';
const drinks = 'water|tea|coffee|juice|beer|wine|coke|cola|soda|milk|lemonade';
const places = 'hong kong|new york|tokyo|seoul|busan|london|paris|singapore|taipei|bangkok|osaka|airport|hotel|station|museum|restaurant|downtown|city center|city centre|home';
const positive = /^(yes|yeah|yep|sure|of course|okay|ok|fine|sounds good|that is (fine|okay|ok|right|correct)|i do|absolutely)\b/;
const negative = /^(no|nope|not really|i do not|i have no|that is not|it is not)\b/;
const strip = t => t.replace(/^(yes |yeah |sure )/,'').replace(/^(please |the |a |an |some )/,'').replace(/ (please|thanks|thank you)$/,'');
const choice = (t, alternatives) => new RegExp(`^(?:(?:i would like|i want|i need|i prefer|i will have|can i have|could i have|i will pay|i would like to pay|by|with|in|it is|size|make it) )?(?:a |an |the |some )?(?:${alternatives})(?: (?:seat|one|please|thanks|thank you))?$`).test(strip(t));

export function evaluateAnswer(turn, transcript) {
  const t = normalizeSpeech(transcript);
  const result = (level, explanation, naturalAnswer = turn.naturalAnswer, category = level === 'pass' ? 'accepted' : 'unconfirmed') => ({level, explanation, naturalAnswer, category, normalizedTranscript:t});
  const pass = why => result('pass', why + ' 예시와 단어가 달라도 괜찮아요.',String(transcript).trim());
  const almost = (why, example) => result('almost',why,example,'expression');
  if (!t) return result('retry','인식된 말이 없어서 평가하지 않았어요. 말한 뒤 마이크를 다시 눌러 종료해 주세요.',turn.naturalAnswer,'recognition');
  const id = turn.id;
  if (/^yes\b/.test(t) && /\b(do not|have no|is not|second|third|fourth|fifth)\b/.test(t)) return almost('Yes(네)와 뒤의 부정 또는 방문 횟수가 서로 맞지 않아요. 첫 방문이 아니라면 No로 시작하거나 방문 횟수만 말해도 돼요.');
  if (id === 'imm-purpose') {
    if (/\btrip\b/.test(t)) {
      if (/\bsure\b/.test(t)) return almost('trip은 여행이지만 sure는 ‘확신하는’이라는 뜻이에요. here(여기에)를 말했는데 sure로 인식됐을 수도 있으니 내 녹음을 들어보세요.','I am here on vacation.');
      if (t === 'trip' || /\bfor trip\b/.test(t)) return almost('여행이라는 뜻은 전달됐어요. trip은 셀 수 있는 명사라 a trip이라고 해요. 방문 목적에는 on vacation(휴가) 또는 for sightseeing(관광)이 더 구체적이에요.','I am here on vacation.');
    }
    if (/\b(tourism|vacation|holiday|sightseeing|business|honeymoon|travel|conference|study|studying)\b/.test(t) || /\bvisit(?:ing)? (?:my |a |some )?(?:family|friends|wife|husband|parents)\b/.test(t) || /\bon a trip\b/.test(t)) return pass('방문 목적이 전달됐어요. 관광뿐 아니라 출장·신혼여행·가족 방문도 답이 될 수 있어요.');
  }
  if (id === 'airport-destination' || id === 'taxi-destination') {
    if (choice(t, places) || new RegExp(`^(?:i am (?:flying|going|traveling|travelling) to|take me to|please take me to|i would like to go to) (?:the )?(?:${places})(?: please)?$`).test(t)) return pass('목적지를 답했어요. 홍콩이나 공항으로 고정된 문제가 아니에요.');
    if (/\bto$/.test(t)) return almost('‘~로 간다’까지 들렸지만 목적지가 빠졌어요. to 다음에 도시나 장소 이름을 붙여 주세요.');
  }
  if (id === 'airport-bag' && (positive.test(t) || negative.test(t) || new RegExp(`^(?:i have )?${number} (?:bags?|suitcases?)(?: to check)?$`).test(strip(t)))) return pass('부칠 짐이 있는지 답했어요. 개수가 달라도, 짐이 없다고 해도 괜찮아요.');
  if (id === 'airport-seat' && choice(t,'window|aisle|either|no preference')) return pass('원하는 좌석을 골랐어요. window는 창가, aisle은 통로 좌석이에요.');
  if (id.endsWith('passport') && /^(sure|yes|of course|here (?:you are|it is|is my passport)|this is my passport)\b/.test(t)) return pass('여권을 보여 달라는 요청에 응했어요. Here you are는 ‘여기 있습니다’라는 뜻이에요.');
  if (id === 'airport-gate' && /^(thank you|thanks|okay|ok|got it)\b/.test(t)) return pass('안내를 확인하거나 감사 인사를 했어요.');
  if (['imm-duration','hotel-nights','rest-party','hotel-keys'].includes(id)) {
    if (/\byears? old\b/.test(t)) return result('retry','years old는 나이를 말해요. 머무르는 기간은 days(일), weeks(주), months(개월)를 사용해 주세요.',turn.naturalAnswer,'meaning');
    const units = id === 'imm-duration' ? '(?:days?|weeks?|months?|years?)' : id === 'hotel-nights' ? 'nights?' : id === 'rest-party' ? '(?:people|persons?)' : 'keys?';
    if (new RegExp(`^(?:(?:i am staying|i will stay|we are staying|we will stay|i need|we need|a table|there are) )?(?:for )?${number}(?: ${units})?(?: of us)?(?: please)?$`).test(t) && (id !== 'imm-duration' || new RegExp(units).test(t))) return pass('필요한 수량이나 기간을 답했어요. 예시와 숫자가 같을 필요는 없어요.');
  }
  if (id === 'imm-hotel' && /\b(hotel|hostel|airbnb|hyatt|ymca|salisbury|friend s house|family|apartment)\b/.test(t)) return pass('숙소나 머무를 곳을 답했어요. 호텔 이름이 예시와 달라도 괜찮아요.');
  if (id === 'imm-first' && (positive.test(t) || negative.test(t) || /^(?:this is|it is) my (first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth) (?:visit|time)$/.test(t) || /^i have been here before$/.test(t))) return pass('첫 방문인지 또는 몇 번째 방문인지 답했어요. Yes 없이 This is my first visit만 말해도 맞아요.');
  if (['imm-return','hotel-reservation','hotel-breakfast','taxi-address','taxi-time','shop-price','shop-try','rest-spicy'].includes(id)) {
    if (positive.test(t) || negative.test(t) || (id === 'hotel-reservation' && /^i have a reservation\b/.test(t)) || (id === 'imm-return' && /^i have a (return|round trip) ticket\b/.test(t)) || (id === 'rest-spicy' && choice(t,'not spicy|mild|spicy|a little spicy'))) return pass('동의하거나 거절하는 뜻이 전달됐어요. 자신의 상황에 맞게 Yes와 No 중 선택하면 돼요.');
  }
  if (id === 'rest-order' && choice(t,`${foods}|${drinks}`)) return pass('음식 또는 음료를 주문했어요. chicken만 정답이 아니며 Water, please도 가능한 주문이에요.');
  if (id === 'rest-drink' && (choice(t,drinks) || /^(no thanks|nothing|nothing thank you)$/.test(t))) return pass('원하는 음료 또는 음료가 필요 없다는 뜻을 답했어요.');
  if (id === 'rest-bill' && (/^(no|nothing|that is all|that is it|we are good)\b/.test(t) || choice(t,`${foods}|${drinks}|bill|check|menu|napkins`) || /^(can|could) (i|we) (have|get) (the |some )?(bill|check|water|napkins)( please)?$/.test(t))) return pass('더 필요한 것이 있는지 답했어요. No, thanks는 ‘아니요, 괜찮습니다’라서 올바른 답이에요.');
  if ((id === 'taxi-pay' || id === 'shop-pay') && choice(t,'card|cash|credit card|debit card|apple pay|google pay|contactless')) return pass('결제 수단을 답했어요. 현금과 카드 모두 가능한 표현이에요.');
  if (id === 'taxi-stop') {
    if (/^(?:please )?(?:stop )?(?:at |in front of |by |near )?(?:the )?(?:here|there|next corner|corner|entrance|door|traffic lights|hotel|station)(?: please)?$/.test(t) || /^please stop (?:in front of|outside) (?:the )?[a-z ]+$/.test(t)) return pass('세울 위치를 알려 줬어요. Please stop at the next corner는 ‘다음 모퉁이에 세워 주세요’라는 올바른 표현이에요.');
    if (/\bstop to (?:the )?next corner\b/.test(t)) return almost('다음 모퉁이라는 뜻은 전달됐어요. 멈출 위치에는 to보다 at을 사용해요.','Please stop at the next corner.');
  }
  if (id === 'shop-size' && choice(t,'extra small|small|medium|large|extra large|double extra large|s|m|l|xl|xxl|[1-9][0-9]')) return pass('원하는 사이즈를 답했어요. medium 이외의 사이즈도 맞아요.');
  if (id === 'shop-color' && choice(t,'black|white|yellow|red|blue|green|pink|purple|brown|gray|grey|orange|beige|navy|light blue|dark blue')) return pass('원하는 색상을 답했어요. yellow는 노란색이며 black 대신 골라도 올바른 답이에요.');
  return result('retry','이 표현은 현재 앱의 판정 규칙으로 뜻을 확실히 확인하지 못했어요. 영어가 틀렸다고 단정하는 결과는 아니에요. 인식된 문장과 내 녹음을 비교하고, 질문에 맞는 내용을 말했는지 확인해 주세요.');
}

export const scenarios = [
  {
    id: 'airport', title: '공항', emoji: '✈️', description: '체크인부터 탑승구 확인까지',
    turns: [
      { id:'airport-destination', prompt:'Where are you flying today?', translation:'오늘 어디로 가시나요?', requiredGroups:[['hong kong','hongkong']], optionalKeywords:['flying','to'], exampleAnswers:['Hong Kong.','I am flying to Hong Kong.'], naturalAnswer:'I am flying to Hong Kong.' },
      { id:'airport-bag', prompt:'Do you have any bags to check?', translation:'부칠 짐이 있나요?', requiredGroups:[['yes','yeah'],['one','1','bag']], optionalKeywords:['check'], exampleAnswers:['Yes, one bag.'], naturalAnswer:'Yes, one bag.' },
      { id:'airport-seat', prompt:'Would you like a window or aisle seat?', translation:'창가와 통로 중 어느 좌석을 원하시나요?', requiredGroups:[['window']], optionalKeywords:['please'], exampleAnswers:['Window, please.'], naturalAnswer:'Window, please.' },
      { id:'airport-passport', prompt:'Can I see your passport?', translation:'여권을 보여주시겠어요?', requiredGroups:[['here you are','sure','yes','of course']], optionalKeywords:['passport'], exampleAnswers:['Sure, here you are.'], naturalAnswer:'Sure, here you are.' },
      { id:'airport-gate', prompt:'Here is your boarding pass. Your gate is twelve.', translation:'탑승권입니다. 탑승구는 12번입니다.', requiredGroups:[['thank you','thanks']], optionalKeywords:[], exampleAnswers:['Thank you.'], naturalAnswer:'Thank you.' },
    ]
  },
  {
    id:'immigration', title:'입국심사', emoji:'🛂', description:'입국 목적과 체류 기간 말하기',
    turns:[
      { id:'imm-purpose', prompt:'What is the purpose of your visit?', translation:'방문 목적이 무엇인가요?', requiredGroups:[['travel','tourism','vacation','holiday']], optionalKeywords:['here','for'], exampleAnswers:['For travel.','I am here for vacation.'], naturalAnswer:'I am here for vacation.' },
      { id:'imm-duration', prompt:'How long will you stay?', translation:'얼마나 머무르시나요?', requiredGroups:[['seven','7'],['day','days']], optionalKeywords:['stay'], exampleAnswers:['Seven days.'], naturalAnswer:'Seven days.' },
      { id:'imm-hotel', prompt:'Where are you staying?', translation:'어디에 머무르시나요?', requiredGroups:[['hotel','hyatt','ymca','salisbury']], optionalKeywords:['staying','at'], exampleAnswers:['At a hotel.'], naturalAnswer:'I am staying at a hotel.' },
      { id:'imm-return', prompt:'Do you have a return ticket?', translation:'돌아가는 항공권이 있나요?', requiredGroups:[['yes','yeah','i do']], optionalKeywords:['return','ticket'], exampleAnswers:['Yes, I do.'], naturalAnswer:'Yes, I do.' },
      { id:'imm-first', prompt:'Is this your first visit?', translation:'첫 방문인가요?', requiredGroups:[['yes','yeah','it is']], optionalKeywords:['first'], exampleAnswers:['Yes, it is.'], naturalAnswer:'Yes, it is.' },
    ]
  },
  {
    id:'hotel', title:'호텔', emoji:'🏨', description:'체크인부터 조식 안내까지',
    turns:[
      { id:'hotel-reservation', prompt:'Hi. Do you have a reservation?', translation:'안녕하세요. 예약하셨나요?', requiredGroups:[['yes','yeah','i do']], optionalKeywords:['reservation','have'], exampleAnswers:['Yes, I have a reservation.'], naturalAnswer:'Yes, I have a reservation.' },
      { id:'hotel-passport', prompt:'May I see your passport?', translation:'여권을 보여주시겠어요?', requiredGroups:[['here you are','sure','yes','of course']], optionalKeywords:['passport'], exampleAnswers:['Sure. Here you are.'], naturalAnswer:'Sure. Here you are.' },
      { id:'hotel-nights', prompt:'How many nights are you staying?', translation:'몇 박 머무르시나요?', requiredGroups:[['three','3'],['night','nights']], optionalKeywords:['stay','staying'], exampleAnswers:['Three nights.','I am staying for three nights.'], naturalAnswer:'Three nights.' },
      { id:'hotel-keys', prompt:'Would you like one key or two?', translation:'키는 하나 드릴까요, 두 개 드릴까요?', requiredGroups:[['one','1'],['key']], optionalKeywords:['please'], exampleAnswers:['One key, please.'], naturalAnswer:'One key, please.' },
      { id:'hotel-breakfast', prompt:'Breakfast is from seven to ten. Is that okay?', translation:'조식은 7시부터 10시까지입니다. 괜찮으신가요?', requiredGroups:[['yes','okay','ok','fine','sounds good']], optionalKeywords:['thank'], exampleAnswers:['Yes, that is fine.'], naturalAnswer:'Yes, that is fine.' },
    ]
  },
  {
    id:'restaurant', title:'식당', emoji:'🍽️', description:'인원, 주문, 결제 말하기',
    turns:[
      { id:'rest-party', prompt:'How many people?', translation:'몇 분이신가요?', requiredGroups:[['two','2']], optionalKeywords:['people','table'], exampleAnswers:['Two, please.'], naturalAnswer:'Two, please.' },
      { id:'rest-order', prompt:'What would you like to order?', translation:'무엇을 주문하시겠어요?', requiredGroups:[['chicken']], optionalKeywords:['please','like'], exampleAnswers:['The chicken, please.'], naturalAnswer:'The chicken, please.' },
      { id:'rest-drink', prompt:'What would you like to drink?', translation:'음료는 무엇으로 하시겠어요?', requiredGroups:[['water']], optionalKeywords:['please'], exampleAnswers:['Water, please.'], naturalAnswer:'Water, please.' },
      { id:'rest-spicy', prompt:'Would you like it spicy?', translation:'맵게 해드릴까요?', requiredGroups:[['no','not spicy']], optionalKeywords:['please'], exampleAnswers:['No, not spicy, please.'], naturalAnswer:'No, not spicy, please.' },
      { id:'rest-bill', prompt:'Is there anything else?', translation:'더 필요한 것이 있으신가요?', requiredGroups:[['bill','check']], optionalKeywords:['please','no'], exampleAnswers:['The bill, please.'], naturalAnswer:'The bill, please.' },
    ]
  },
  {
    id:'taxi', title:'택시', emoji:'🚕', description:'목적지와 결제 방법 말하기',
    turns:[
      { id:'taxi-destination', prompt:'Where would you like to go?', translation:'어디로 가시나요?', requiredGroups:[['airport']], optionalKeywords:['please','go'], exampleAnswers:['The airport, please.'], naturalAnswer:'The airport, please.' },
      { id:'taxi-address', prompt:'Is this the right address?', translation:'이 주소가 맞나요?', requiredGroups:[['yes','right','correct']], optionalKeywords:['address'], exampleAnswers:['Yes, that is right.'], naturalAnswer:'Yes, that is right.' },
      { id:'taxi-time', prompt:'It will take about twenty minutes. Is that okay?', translation:'약 20분 걸립니다. 괜찮으신가요?', requiredGroups:[['yes','okay','ok','fine']], optionalKeywords:[], exampleAnswers:['Yes, that is okay.'], naturalAnswer:'Yes, that is okay.' },
      { id:'taxi-pay', prompt:'Would you like to pay by card or cash?', translation:'카드와 현금 중 어떻게 결제하시겠어요?', requiredGroups:[['card']], optionalKeywords:['pay','please'], exampleAnswers:['By card, please.'], naturalAnswer:'By card, please.' },
      { id:'taxi-stop', prompt:'Where should I stop?', translation:'어디에 세워드릴까요?', requiredGroups:[['here']], optionalKeywords:['please','stop'], exampleAnswers:['Here, please.'], naturalAnswer:'Here, please.' },
    ]
  },
  {
    id:'shopping', title:'쇼핑', emoji:'🛍️', description:'사이즈, 색상, 착용, 결제 말하기',
    turns:[
      { id:'shop-size', prompt:'What size do you need?', translation:'어떤 사이즈가 필요하세요?', requiredGroups:[['medium','m']], optionalKeywords:['size'], exampleAnswers:['Medium, please.'], naturalAnswer:'Medium, please.' },
      { id:'shop-color', prompt:'What color would you like?', translation:'어떤 색상을 원하세요?', requiredGroups:[['black']], optionalKeywords:['please'], exampleAnswers:['Black, please.'], naturalAnswer:'Black, please.' },
      { id:'shop-try', prompt:'Would you like to try it on?', translation:'입어보시겠어요?', requiredGroups:[['yes','yeah','please']], optionalKeywords:['try'], exampleAnswers:['Yes, please.'], naturalAnswer:'Yes, please.' },
      { id:'shop-price', prompt:'It is thirty dollars. Is that okay?', translation:'30달러입니다. 괜찮으신가요?', requiredGroups:[['yes','okay','ok','fine']], optionalKeywords:[], exampleAnswers:['Yes, that is fine.'], naturalAnswer:'Yes, that is fine.' },
      { id:'shop-pay', prompt:'How would you like to pay?', translation:'어떻게 결제하시겠어요?', requiredGroups:[['card']], optionalKeywords:['pay','please'], exampleAnswers:['By card, please.'], naturalAnswer:'By card, please.' },
    ]
  }
];

export function getScenario(id) {
  return scenarios.find((scenario) => scenario.id === id) ?? scenarios[0];
}

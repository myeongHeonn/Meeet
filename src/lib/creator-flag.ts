// 폴 생성 직후 같은 탭에서 폴 페이지에 진입한 생성자를 식별하기 위한 sessionStorage 키.
// 링크로 들어온 참가자에게는 이 플래그가 없으므로 공유 배너가 뜨지 않는다.
export function creatorFlagKey(token: string): string {
  return `meeet:creator:${token}`;
}

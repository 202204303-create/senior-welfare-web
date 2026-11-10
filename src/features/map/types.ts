export type FacilityType = '복지관' | '보건소' | '경로당' | '치매안심센터' | '일자리센터'

export interface Facility {
  id: string
  name: string
  type: FacilityType
  lat: number
  lng: number
  address: string
  phone: string
  hours: string
}

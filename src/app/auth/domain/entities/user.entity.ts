export interface Privilege {
    module: string;
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  }
  
  export class User {
    constructor(
      public readonly id: string,
      public readonly email: string,
      public readonly name: string,
      public readonly lastName: string,
      public readonly photo: string,
      public readonly phone: string,
      public readonly verifiedEmail: boolean,
      public readonly businessId: string,
      public readonly privileges: Privilege[],
      public readonly accessLevelId: string,
      public readonly profileTypeId: string,
      public readonly affiliationTypeId: string,
      public readonly departmentId: string,
      public readonly createdAt: Date,
      public readonly token: string
    ) {}
  }
  
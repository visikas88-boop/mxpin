// 积分充值相关的 TypeScript 类型定义

export interface UserInfo {
    id: number;
    username: string;
    email: string;
    balancePoints: number;
    memberLevel?: string;
    memberExpireAt?: string;
}

export interface RechargePackage {
    id: number;
    packageType: "limited" | "daily";
    packageName: string;
    packageNameEn: string;
    price: number;
    originalPrice?: number;
    basePoints: number;
    giftPoints: number;
    totalPoints: number;
    giftPercent: number;
    giftDesc?: string;
    validType: "permanent" | "timeLimit";
    validDays?: number;
    validEndDate?: string;
    desc: string;
    descEn: string;
    isHot?: boolean;
    sortOrder: number;
}

export interface PackageGroup {
    groupId: string;
    groupType: "limited" | "daily";
    groupName: string;
    groupNameEn: string;
    groupDesc: string;
    groupDescEn: string;
    sortOrder: number;
    packages: RechargePackage[];
}

export interface RechargePackagesResponse {
    success: boolean;
    data: {
        userInfo: UserInfo;
        packageGroups: PackageGroup[];
    };
}

export interface CreateOrderRequest {
    packageId: number;
}

export interface CreateOrderResponse {
    success: boolean;
    data: {
        orderId: string;
        packageId: number;
        amount: number;
        totalPoints: number;
        paymentUrl?: string;
        qrCode?: string;
    };
    message: string;
}

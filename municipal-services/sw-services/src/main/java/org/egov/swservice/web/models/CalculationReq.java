package org.egov.swservice.web.models;

import java.util.List;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;

import org.egov.common.contract.request.RequestInfo;
import org.springframework.validation.annotation.Validated;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * CalculationReq
 */
@Validated
@javax.annotation.Generated(value = "org.egov.codegen.SpringBootCodegen", date = "2018-05-14T00:55:55.623+05:30")

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@ToString
public class CalculationReq   {
	
		@JsonProperty("RequestInfo")
		@NotNull
        private RequestInfo requestInfo;

        @Valid
        @NotNull
        @JsonProperty("CalculationCriteria")
        private List<CalculationCriteria> calculationCriteria;
        
    	@JsonProperty("isconnectionCalculation")
		@NotNull
		 private Boolean isconnectionCalculation;

        @JsonProperty("disconnectRequest")
        private Boolean disconnectRequest = false;


        public CalculationReq addCalulationCriteriaItem(CalculationCriteria calulationCriteriaItem) {
        this.calculationCriteria.add(calulationCriteriaItem);
        return this;
        }

}

